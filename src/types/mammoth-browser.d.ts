declare module "mammoth/mammoth.browser" {
  interface ConvertResult {
    value: string;
    messages: unknown[];
  }
  interface Input {
    arrayBuffer: ArrayBuffer;
  }
  const mammoth: {
    convertToHtml(input: Input): Promise<ConvertResult>;
    extractRawText(input: Input): Promise<ConvertResult>;
  };
  export default mammoth;
}
