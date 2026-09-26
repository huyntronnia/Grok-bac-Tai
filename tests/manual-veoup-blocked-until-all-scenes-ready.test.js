"use strict";
require("./helpers/manual-scenarios").runScenario("audit").catch((error) => { console.error(error); process.exitCode = 1; });
