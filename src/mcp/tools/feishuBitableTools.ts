import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { formatErrorMessage } from '../../utils/error.js';
import { FeishuApiService } from '../../services/feishuApiService.js';
import { Logger } from '../../utils/logger.js';
import {
  BitableAppTokenSchema,
  BitableTableIdSchema,
  BitableRecordIdSchema,
  BitableFilterSchema,
  BitableFieldNamesSchema,
  BitableViewIdSchema,
  BitablePageSizeSchema,
  BitableFieldsSchema,
  BitableRecordsListSchema,
} from '../../types/feishuSchema.js';

/**
 * 注册飞书多维表格（Bitable）相关的MCP工具
 * @param server MCP服务器实例
 * @param feishuService 飞书API服务实例
 */
export function registerFeishuBitableTools(server: McpServer, feishuService: FeishuApiService | null): void {
  // 获取多维表格元数据
  server.tool(
    'get_feishu_bitable_info',
    'Retrieves metadata of a Feishu Bitable (multi-dimensional table) app, including its name and revision. ' +
    'Use this to verify access and get an overview before querying tables. ' +
    'When a Feishu document contains an embedded bitable block (block_type: 18), ' +
    'the app token is in the bitable.token field (take the part before the underscore "_").',
    {
      appToken: BitableAppTokenSchema,
    },
    async ({ appToken }) => {
      try {
        if (!feishuService) {
          return { content: [{ type: 'text', text: 'Feishu service is not initialized.' }] };
        }
        Logger.info(`开始获取多维表格信息，appToken: ${appToken}`);
        const info = await feishuService.getBitableAppInfo(appToken);
        return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
      } catch (error) {
        Logger.error(`获取多维表格信息失败:`, error);
        return { content: [{ type: 'text', text: formatErrorMessage(error, '获取多维表格信息失败') }] };
      }
    },
  );

  // 获取所有数据表列表
  server.tool(
    'get_feishu_bitable_tables',
    'Retrieves all data tables within a Feishu Bitable app. ' +
    'Returns table names and IDs. Always call this before querying records to get the correct tableId. ' +
    'The app token can be obtained from a document block\'s bitable.token field or from the bitable URL.\n\n' +
    'IMPORTANT: For bitable blocks embedded inside a Feishu document (block_type: 18), ' +
    'the bitable.token field is formatted as "appToken_tableId" (e.g. "K2Xqb8xxx_tblYFJzzz"). ' +
    'In this case:\n' +
    '- appToken = the part BEFORE the underscore (e.g. "K2Xqb8xxx")\n' +
    '- tableId = the part AFTER the underscore (e.g. "tblYFJzzz")\n' +
    'If this tool returns an error, you already have the tableId from the token — ' +
    'use it directly with get_feishu_bitable_records, get_feishu_bitable_fields, etc.',
    {
      appToken: BitableAppTokenSchema,
    },
    async ({ appToken }) => {
      try {
        if (!feishuService) {
          return { content: [{ type: 'text', text: 'Feishu service is not initialized.' }] };
        }
        Logger.info(`开始获取数据表列表，appToken: ${appToken}`);

        // 尝试从原始输入中提取内嵌的 tableId（格式：appToken_tableId）
        const embeddedTableId = appToken.includes('_')
          ? appToken.substring(appToken.indexOf('_') + 1)
          : null;

        try {
          const tables = await feishuService.getBitableTables(appToken);
          Logger.info(`数据表列表获取成功，共 ${tables?.total ?? 0} 个表`);
          return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] };
        } catch (apiError) {
          // tables 接口失败（常见于文档内嵌 bitable），给出明确提示和已知 tableId
          Logger.warn(`获取数据表列表失败，尝试提供内嵌 tableId 提示`);
          const hint = embeddedTableId
            ? `\n\n💡 提示：该多维表格为文档内嵌类型，tables 接口不可用。\n` +
              `但已从 token 中提取到 tableId：${embeddedTableId}\n` +
              `可直接使用以下工具操作该表：\n` +
              `- get_feishu_bitable_records（appToken: "${appToken.substring(0, appToken.indexOf('_'))}", tableId: "${embeddedTableId}"）\n` +
              `- get_feishu_bitable_fields（appToken: "${appToken.substring(0, appToken.indexOf('_'))}", tableId: "${embeddedTableId}"）`
            : '';
          return {
            content: [{ type: 'text', text: formatErrorMessage(apiError, '获取数据表列表失败') + hint }],
          };
        }
      } catch (error) {
        Logger.error(`获取数据表列表失败:`, error);
        return { content: [{ type: 'text', text: formatErrorMessage(error, '获取数据表列表失败') }] };
      }
    },
  );

  // 获取字段（列）定义
  server.tool(
    'get_feishu_bitable_fields',
    'Retrieves the field (column) definitions of a specific table in a Feishu Bitable. ' +
    'Returns field names, types, and configuration. ' +
    'Use this to understand the table schema before reading or writing records.',
    {
      appToken: BitableAppTokenSchema,
      tableId: BitableTableIdSchema,
    },
    async ({ appToken, tableId }) => {
      try {
        if (!feishuService) {
          return { content: [{ type: 'text', text: 'Feishu service is not initialized.' }] };
        }
        Logger.info(`开始获取字段列表，appToken: ${appToken}，tableId: ${tableId}`);
        const fields = await feishuService.getBitableFields(appToken, tableId);
        Logger.info(`字段列表获取成功，共 ${fields?.total ?? 0} 个字段`);
        return { content: [{ type: 'text', text: JSON.stringify(fields, null, 2) }] };
      } catch (error) {
        Logger.error(`获取字段列表失败:`, error);
        return { content: [{ type: 'text', text: formatErrorMessage(error, '获取字段列表失败') }] };
      }
    },
  );

  // 查询记录
  server.tool(
    'get_feishu_bitable_records',
    'Queries records (rows) from a Feishu Bitable table. ' +
    'Supports filtering, field selection, and view filtering. ' +
    'Automatically fetches all pages up to 5000 records when no pageToken is provided. ' +
    'Use get_feishu_bitable_tables to get tableId first.',
    {
      appToken: BitableAppTokenSchema,
      tableId: BitableTableIdSchema,
      filter: BitableFilterSchema,
      fieldNames: BitableFieldNamesSchema,
      viewId: BitableViewIdSchema,
      pageSize: BitablePageSizeSchema,
    },
    async ({ appToken, tableId, filter, fieldNames, viewId, pageSize }) => {
      try {
        if (!feishuService) {
          return { content: [{ type: 'text', text: 'Feishu service is not initialized.' }] };
        }
        Logger.info(`开始查询记录，appToken: ${appToken}，tableId: ${tableId}`);
        const records = await feishuService.getBitableRecords(appToken, tableId, {
          filter,
          fieldNames,
          viewId,
          pageSize,
        });
        Logger.info(`记录查询成功，共 ${records?.total ?? records?.items?.length ?? 0} 条`);
        return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
      } catch (error) {
        Logger.error(`查询记录失败:`, error);
        return { content: [{ type: 'text', text: formatErrorMessage(error, '查询多维表格记录失败') }] };
      }
    },
  );

  // 新增单条记录
  server.tool(
    'create_feishu_bitable_record',
    'Creates a new record (row) in a Feishu Bitable table. ' +
    'Provide field values as a key-value map where keys are field names. ' +
    'Use get_feishu_bitable_fields to understand available fields and their types before writing.',
    {
      appToken: BitableAppTokenSchema,
      tableId: BitableTableIdSchema,
      fields: BitableFieldsSchema,
    },
    async ({ appToken, tableId, fields }) => {
      try {
        if (!feishuService) {
          return { content: [{ type: 'text', text: 'Feishu service is not initialized.' }] };
        }
        Logger.info(`开始新增记录，appToken: ${appToken}，tableId: ${tableId}`);
        const result = await feishuService.createBitableRecord(appToken, tableId, fields);
        Logger.info(`新增记录成功`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        Logger.error(`新增记录失败:`, error);
        return { content: [{ type: 'text', text: formatErrorMessage(error, '新增多维表格记录失败') }] };
      }
    },
  );

  // 批量新增记录
  server.tool(
    'create_feishu_bitable_records_batch',
    'Creates multiple records (rows) in a Feishu Bitable table in a single request. ' +
    'More efficient than creating records one by one. Maximum recommended batch size is 500 records.',
    {
      appToken: BitableAppTokenSchema,
      tableId: BitableTableIdSchema,
      records: BitableRecordsListSchema,
    },
    async ({ appToken, tableId, records }) => {
      try {
        if (!feishuService) {
          return { content: [{ type: 'text', text: 'Feishu service is not initialized.' }] };
        }
        Logger.info(`开始批量新增记录，appToken: ${appToken}，tableId: ${tableId}，数量: ${records.length}`);
        const result = await feishuService.createBitableRecordsBatch(appToken, tableId, records);
        Logger.info(`批量新增记录成功`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        Logger.error(`批量新增记录失败:`, error);
        return { content: [{ type: 'text', text: formatErrorMessage(error, '批量新增多维表格记录失败') }] };
      }
    },
  );

  // 更新记录
  server.tool(
    'update_feishu_bitable_record',
    'Updates an existing record in a Feishu Bitable table. ' +
    'Only the fields provided will be updated; other fields remain unchanged. ' +
    'Use get_feishu_bitable_records to find the recordId first.',
    {
      appToken: BitableAppTokenSchema,
      tableId: BitableTableIdSchema,
      recordId: BitableRecordIdSchema,
      fields: BitableFieldsSchema,
    },
    async ({ appToken, tableId, recordId, fields }) => {
      try {
        if (!feishuService) {
          return { content: [{ type: 'text', text: 'Feishu service is not initialized.' }] };
        }
        Logger.info(`开始更新记录，appToken: ${appToken}，tableId: ${tableId}，recordId: ${recordId}`);
        const result = await feishuService.updateBitableRecord(appToken, tableId, recordId, fields);
        Logger.info(`更新记录成功`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        Logger.error(`更新记录失败:`, error);
        return { content: [{ type: 'text', text: formatErrorMessage(error, '更新多维表格记录失败') }] };
      }
    },
  );

  // 删除记录
  server.tool(
    'delete_feishu_bitable_record',
    'Deletes a record (row) from a Feishu Bitable table. This action is irreversible. ' +
    'Use get_feishu_bitable_records to find the recordId before deleting.',
    {
      appToken: BitableAppTokenSchema,
      tableId: BitableTableIdSchema,
      recordId: BitableRecordIdSchema,
    },
    async ({ appToken, tableId, recordId }) => {
      try {
        if (!feishuService) {
          return { content: [{ type: 'text', text: 'Feishu service is not initialized.' }] };
        }
        Logger.info(`开始删除记录，appToken: ${appToken}，tableId: ${tableId}，recordId: ${recordId}`);
        const result = await feishuService.deleteBitableRecord(appToken, tableId, recordId);
        Logger.info(`删除记录成功`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        Logger.error(`删除记录失败:`, error);
        return { content: [{ type: 'text', text: formatErrorMessage(error, '删除多维表格记录失败') }] };
      }
    },
  );
}
