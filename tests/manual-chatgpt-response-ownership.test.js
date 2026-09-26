"use strict";
require("./helpers/manual-scenarios").runScenario("ownership").catch((error) => { console.error(error); process.exitCode = 1; });
