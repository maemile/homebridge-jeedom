const localPackage = require("./package.json"),
    exec = require("child_process").exec;
exec(`npm info ${localPackage.name} version`, (error, stdout, stderr) => {
    if (error) console.error(error);
    else if (stderr) console.error(stderr);
    else if (localPackage.version === stdout.slice(0, -1)) console.info(`You cannot publish over the previously published versions (${localPackage.version})`);
    else exec("npm publish", (error, stdout, stderr) => {
        if (error) console.error(error);
        if (stderr) console.error(stderr);
        if (stdout) console.info(stdout);
    });
});