module.exports = {
  ...require("./chatgpt_core"),
  ...require("./chatgpt_dom"),
  ...require("./chatgpt_send"),
  ...require("./chatgpt_upload"),
  ...require("./chatgpt_recovery"),
  ...require("./chatgpt_pipeline"),
  chatGptRuntimeMonitor: require("./chatgpt_runtime_monitor"),
};

