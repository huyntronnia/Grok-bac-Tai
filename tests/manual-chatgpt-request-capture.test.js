"use strict";
require("./helpers/manual-scenarios").runScenario("override").catch((error) => { console.error(error); process.exitCode = 1; });
