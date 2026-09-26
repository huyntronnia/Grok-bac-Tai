"use strict";
require("./helpers/manual-scenarios").runScenario("bundles").catch((error) => { console.error(error); process.exitCode = 1; });
