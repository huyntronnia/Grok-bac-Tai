"use strict";
require("./helpers/manual-scenarios").runScenario("isolation").catch((error) => { console.error(error); process.exitCode = 1; });
