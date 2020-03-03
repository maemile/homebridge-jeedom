require("../index");
console.info("The index file can run");

Object.keys(require("../package.json").dependencies).forEach(dependence => require(dependence));
console.info("All dependencies can be load");
