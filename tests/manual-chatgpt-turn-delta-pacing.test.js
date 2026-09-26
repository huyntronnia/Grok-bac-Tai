"use strict";
require("./helpers/manual-scenarios").runScenario("receipts").catch((error) => { console.error(error); process.exitCode = 1; });
