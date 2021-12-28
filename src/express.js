const express = require("express");
const cors = require("cors");
const express_prettify = require("express-prettify");
const fs = require("fs");
const path = require("path");
const os = require("os");
const cli_args = require("minimist")(process.argv.slice(2));
const PathRepo = path.join(path.resolve(cli_args.download_path || os.homedir(), ".DebianRepo/"), "public/");

const app = express();
app.use(cors());
app.use(express_prettify({always: true}));
app.get(["/", "/setup_script"], (req, res) => {
  if (!(fs.existsSync(PathRepo))) {
    res.status(401).json({
      error: "Repo not created"
    })
    return;
  }
  const Host = req.query.host || req.headers.host;
  const Protocol = req.query.protocol || req.headers.protocol || "http";
  const Prefix = req.query.termux === "true" ? "/data/data/com.termux/files/usr" : ""
  const Components = fs.readdirSync(PathRepo);
  const ShellScript = [`#!${Prefix}/bin/env bash`, "", ""];
  ShellScript.push(`echo "deb ${Protocol}://${Host}/repo ${Components.join(" ")}" | sudo tee ${Prefix}/etc/apt/sources.list.d/${Components.join("_")}.list`);
  ShellScript.push("apt update");
  ShellScript.push("");
  ShellScript.push("exit 0");
  res.type("text/plain");
  res.send(ShellScript.join("\n"));
});

async function ReadDirRecursive(dir = "./") {
  const Files = fs.readdirSync(dir);
  const Result = [];
  for (const File of Files) {
    const FilePath = path.join(dir, File);
    if (fs.statSync(FilePath).isDirectory()) {
      Result.push(...(await ReadDirRecursive(FilePath)));
    } else {
      const FileStat = fs.statSync(FilePath);
      Result.push({
        path: FilePath,
        size: FileStat.size,
        mtime: FileStat.mtime.toString()
      });
    }
  }
  return Result;
}

app.use("/repo", async (req, res) => {
  const PathReq = path.join(PathRepo, req.path);
  console.log(PathReq);
  if (fs.existsSync(PathReq)) {
    if (fs.statSync(PathReq).isDirectory()) {
      const Data = await ReadDirRecursive(PathReq);
      res.json(Data.map(File => File.replace(PathRepo, "")));
    } else {
      res.sendFile(PathReq);
    }
  } else {
    res.status(404).json({
      error: "Not found"
    })
  }
});

module.exports = {
  listen: (port = 80) => app.listen(port, () => console.log(`Listening on port ${port}`)),
  app: app,
}