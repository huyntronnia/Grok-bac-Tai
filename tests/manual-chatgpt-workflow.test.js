"use strict";
require("./helpers/manual-scenarios").runScenario("crash").catch((error) => { console.error(error); process.exitCode = 1; });
