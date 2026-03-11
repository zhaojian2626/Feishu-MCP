import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { formatErrorMessage } from '../../utils/error.js';
import { FeishuApiService } from '../../services/feishuApiService.js';
import { Logger } from '../../utils/logger.js';
import {
  SpreadsheetTitleSchema,
  SpreadsheetTokenSchema,
  SpreadsheetRangeSchema,
  SpreadsheetRangesSchema,
  ValueRenderOptionSchema,
  DateTimeRenderOptionSchema,
  SpreadsheetWriteValuesSchema,
  SpreadsheetValueRangesSchema,
  FolderTokenSchema,
} from '../../types/feishuSchema.js';

/**
 * 注册飞书电子表格相关的MCP工具
 * @param server MCP服务器实例
 * @param feishuService 飞书API服务实例
 */
export function registerFeishuSpreadsheetTools(server: McpServer, feishuService: FeishuApiService | null): void {
  // 创建电子表格
  server.tool(
    'create_feishu_spreadsheet',
    'Creates a new Feishu spreadsheet file and returns its token and URL. ' +
    'Optionally specify a folder to place it in; if omitted it goes to the root drive. ' +
    'After creation, use set_feishu_spreadsheet_values to write data into it.',
    {
      title: SpreadsheetTitleSchema,
      folderToken: FolderTokenSchema.optional(),
    },
    async ({ title, folderToken }) => {
      try {
        if (!feishuService) {
          return { content: [{ type: 'text', text: 'Feishu service is not initialized.' }] };
        }
        Logger.info(`开始创建电子表格，标题: ${title}`);
        const result = await feishuService.createSpreadsheet(title, folderToken);
        const token = result?.spreadsheet?.spreadsheet_token;
        const url = result?.spreadsheet?.url;
        Logger.info(`电子表格创建成功，token: ${token}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2) +
              (token ? `\n\n✅ 创建成功！\ntoken: ${token}\nURL: ${url ?? '(稍后可在飞书云盘查看)'}` : ''),
          }],
        };
      } catch (error) {
        Logger.error(`创建电子表格失败:`, error);
        return { content: [{ type: 'text', text: formatErrorMessage(error, '创建电子表格失败') }] };
      }
    },
  );

  // 获取电子表格元数据
  server.tool(
    'get_feishu_spreadsheet_info',
    'Retrieves metadata of a Feishu spreadsheet, including its title, revision, and list of sheets. ' +
    'Use this tool to verify a spreadsheet exists and get an overview before reading its data. ' +
    'Accepts either a spreadsheet token (e.g., "shtcnmBA*****") or the full spreadsheet URL.',
    {
      spreadsheetToken: SpreadsheetTokenSchema,
    },
    async ({ spreadsheetToken }) => {
      try {
        if (!feishuService) {
          return {
            content: [{ type: 'text', text: 'Feishu service is not initialized. Please check the configuration.' }],
          };
        }

        Logger.info(`开始获取电子表格元数据，token: ${spreadsheetToken}`);
        const info = await feishuService.getSpreadsheetInfo(spreadsheetToken);
        Logger.info(`电子表格元数据获取成功`);

        return {
          content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
        };
      } catch (error) {
        Logger.error(`获取电子表格元数据失败:`, error);
        const errorMessage = formatErrorMessage(error, '获取电子表格元数据失败');
        return {
          content: [{ type: 'text', text: errorMessage }],
        };
      }
    },
  );

  // 获取所有工作表列表
  server.tool(
    'get_feishu_spreadsheet_sheets',
    'Retrieves all sheets (tabs) within a Feishu spreadsheet, including sheet names, IDs, and indexes. ' +
    'Use this tool before reading data to discover available sheet names for constructing range queries. ' +
    'Accepts either a spreadsheet token or the full spreadsheet URL.',
    {
      spreadsheetToken: SpreadsheetTokenSchema,
    },
    async ({ spreadsheetToken }) => {
      try {
        if (!feishuService) {
          return {
            content: [{ type: 'text', text: 'Feishu service is not initialized. Please check the configuration.' }],
          };
        }

        Logger.info(`开始获取工作表列表，token: ${spreadsheetToken}`);
        const sheets = await feishuService.getSpreadsheetSheets(spreadsheetToken);
        Logger.info(`工作表列表获取成功，数量: ${sheets?.sheets?.length ?? 0}`);

        return {
          content: [{ type: 'text', text: JSON.stringify(sheets, null, 2) }],
        };
      } catch (error) {
        Logger.error(`获取工作表列表失败:`, error);
        const errorMessage = formatErrorMessage(error, '获取工作表列表失败');
        return {
          content: [{ type: 'text', text: errorMessage }],
        };
      }
    },
  );

  // 读取指定范围的数据
  server.tool(
    'get_feishu_spreadsheet_values',
    'Reads cell values from a specified range in a Feishu spreadsheet. ' +
    'Use this to extract data from a spreadsheet for analysis or processing. ' +
    'To get all sheet names, use get_feishu_spreadsheet_sheets first. ' +
    'Range format: "SheetName!A1:D10" or just "A1:D10" for the first sheet.',
    {
      spreadsheetToken: SpreadsheetTokenSchema,
      range: SpreadsheetRangeSchema,
      valueRenderOption: ValueRenderOptionSchema,
      dateTimeRenderOption: DateTimeRenderOptionSchema,
    },
    async ({ spreadsheetToken, range, valueRenderOption, dateTimeRenderOption }) => {
      try {
        if (!feishuService) {
          return {
            content: [{ type: 'text', text: 'Feishu service is not initialized. Please check the configuration.' }],
          };
        }

        Logger.info(`开始读取电子表格数据，token: ${spreadsheetToken}，范围: ${range}`);
        const values = await feishuService.getSpreadsheetValues(
          spreadsheetToken,
          range,
          valueRenderOption,
          dateTimeRenderOption,
        );
        Logger.info(`电子表格数据读取成功`);

        return {
          content: [{ type: 'text', text: JSON.stringify(values, null, 2) }],
        };
      } catch (error) {
        Logger.error(`读取电子表格数据失败:`, error);
        const errorMessage = formatErrorMessage(error, '读取电子表格数据失败');
        return {
          content: [{ type: 'text', text: errorMessage }],
        };
      }
    },
  );

  // 批量读取多个范围的数据
  server.tool(
    'get_feishu_spreadsheet_values_batch',
    'Reads cell values from multiple ranges in a Feishu spreadsheet in a single request. ' +
    'More efficient than making multiple single-range requests when you need data from several areas. ' +
    'Each range follows the format "SheetName!A1:D10". ' +
    'Use get_feishu_spreadsheet_sheets first to retrieve available sheet names.',
    {
      spreadsheetToken: SpreadsheetTokenSchema,
      ranges: SpreadsheetRangesSchema,
      valueRenderOption: ValueRenderOptionSchema,
      dateTimeRenderOption: DateTimeRenderOptionSchema,
    },
    async ({ spreadsheetToken, ranges, valueRenderOption, dateTimeRenderOption }) => {
      try {
        if (!feishuService) {
          return {
            content: [{ type: 'text', text: 'Feishu service is not initialized. Please check the configuration.' }],
          };
        }

        Logger.info(`开始批量读取电子表格数据，token: ${spreadsheetToken}，范围数量: ${ranges.length}`);
        const values = await feishuService.getSpreadsheetValuesBatch(
          spreadsheetToken,
          ranges,
          valueRenderOption,
          dateTimeRenderOption,
        );
        Logger.info(`批量电子表格数据读取成功`);

        return {
          content: [{ type: 'text', text: JSON.stringify(values, null, 2) }],
        };
      } catch (error) {
        Logger.error(`批量读取电子表格数据失败:`, error);
        const errorMessage = formatErrorMessage(error, '批量读取电子表格数据失败');
        return {
          content: [{ type: 'text', text: errorMessage }],
        };
      }
    },
  );

  // 写入指定范围的数据（覆盖）
  server.tool(
    'set_feishu_spreadsheet_values',
    'Writes cell values to a specified range in a Feishu spreadsheet, overwriting existing data. ' +
    'Values are provided as a 2D array (rows × columns). ' +
    'Use get_feishu_spreadsheet_sheets to get sheet names before writing. ' +
    'Range format: "SheetName!A1:D3". The range must match the dimensions of the values array.',
    {
      spreadsheetToken: SpreadsheetTokenSchema,
      range: SpreadsheetRangeSchema,
      values: SpreadsheetWriteValuesSchema,
    },
    async ({ spreadsheetToken, range, values }) => {
      try {
        if (!feishuService) {
          return {
            content: [{ type: 'text', text: 'Feishu service is not initialized. Please check the configuration.' }],
          };
        }

        Logger.info(`开始写入电子表格数据，token: ${spreadsheetToken}，范围: ${range}，行数: ${values.length}`);
        const result = await feishuService.setSpreadsheetValues(spreadsheetToken, range, values);
        Logger.info(`电子表格数据写入成功`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        Logger.error(`写入电子表格数据失败:`, error);
        const errorMessage = formatErrorMessage(error, '写入电子表格数据失败');
        return {
          content: [{ type: 'text', text: errorMessage }],
        };
      }
    },
  );

  // 追加数据到表格末尾
  server.tool(
    'append_feishu_spreadsheet_values',
    'Appends rows of data after the last existing row in a Feishu spreadsheet range. ' +
    'Unlike set_feishu_spreadsheet_values (which overwrites), this tool inserts new rows without modifying existing data. ' +
    'Ideal for adding new records to a table. ' +
    'Range format: "SheetName!A1" (the column anchor) or "SheetName!A1:D1".',
    {
      spreadsheetToken: SpreadsheetTokenSchema,
      range: SpreadsheetRangeSchema,
      values: SpreadsheetWriteValuesSchema,
    },
    async ({ spreadsheetToken, range, values }) => {
      try {
        if (!feishuService) {
          return {
            content: [{ type: 'text', text: 'Feishu service is not initialized. Please check the configuration.' }],
          };
        }

        Logger.info(`开始追加电子表格数据，token: ${spreadsheetToken}，范围: ${range}，行数: ${values.length}`);
        const result = await feishuService.appendSpreadsheetValues(spreadsheetToken, range, values);
        Logger.info(`电子表格数据追加成功`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        Logger.error(`追加电子表格数据失败:`, error);
        const errorMessage = formatErrorMessage(error, '追加电子表格数据失败');
        return {
          content: [{ type: 'text', text: errorMessage }],
        };
      }
    },
  );

  // 批量写入多个范围的数据
  server.tool(
    'set_feishu_spreadsheet_values_batch',
    'Writes cell values to multiple ranges in a Feishu spreadsheet in a single request. ' +
    'More efficient than multiple single-range writes when updating several areas at once. ' +
    'Each item specifies a range and a 2D values array. ' +
    'Use get_feishu_spreadsheet_sheets to get sheet names before writing.',
    {
      spreadsheetToken: SpreadsheetTokenSchema,
      valueRanges: SpreadsheetValueRangesSchema,
    },
    async ({ spreadsheetToken, valueRanges }) => {
      try {
        if (!feishuService) {
          return {
            content: [{ type: 'text', text: 'Feishu service is not initialized. Please check the configuration.' }],
          };
        }

        Logger.info(`开始批量写入电子表格数据，token: ${spreadsheetToken}，批次数: ${valueRanges.length}`);
        const result = await feishuService.setSpreadsheetValuesBatch(spreadsheetToken, valueRanges);
        Logger.info(`批量电子表格数据写入成功`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        Logger.error(`批量写入电子表格数据失败:`, error);
        const errorMessage = formatErrorMessage(error, '批量写入电子表格数据失败');
        return {
          content: [{ type: 'text', text: errorMessage }],
        };
      }
    },
  );

  // 清空指定范围的数据
  server.tool(
    'clear_feishu_spreadsheet_values',
    'Clears (empties) cell values in one or more ranges of a Feishu spreadsheet. ' +
    'This removes the cell content but preserves cell formatting. ' +
    'Provide one or more ranges in the array. ' +
    'Range format: "SheetName!A1:D10".',
    {
      spreadsheetToken: SpreadsheetTokenSchema,
      ranges: SpreadsheetRangesSchema,
    },
    async ({ spreadsheetToken, ranges }) => {
      try {
        if (!feishuService) {
          return {
            content: [{ type: 'text', text: 'Feishu service is not initialized. Please check the configuration.' }],
          };
        }

        Logger.info(`开始清空电子表格数据，token: ${spreadsheetToken}，范围数量: ${ranges.length}`);
        const result = await feishuService.clearSpreadsheetValues(spreadsheetToken, ranges);
        Logger.info(`电子表格数据清空成功`);

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        Logger.error(`清空电子表格数据失败:`, error);
        const errorMessage = formatErrorMessage(error, '清空电子表格数据失败');
        return {
          content: [{ type: 'text', text: errorMessage }],
        };
      }
    },
  );
}
