const child_process = require("child_process");
const fs = require("fs");
const path = require("path");

// Create Branch
const AddBranch = (Branch = "", Dist = "") => child_process.execSync(`aptly repo create -distribution=${Dist} -component=${Branch} ${Branch}`, {stdio: "pipe"});

// Add Files to Branch
const AddFiles = (Branch = "", ...Files) => child_process.execFileSync("aptly", ["repo", "add", Branch, ...Files], {stdio: "pipe"});

// Publish Repository
const PublishRepo = (Dist = "", Passworld = "", GpgID = "", Sign = true, ...Components) => {
  const Args = []
  if (Sign) Args.push(`-passphrase=${Passworld}`, `-gpg-key=${GpgID}`);
  else Args.push("-skip-signing",);
  child_process.execFileSync("aptly", ["publish", "repo", "-batch", ...Args, `-label=${Dist}`, `-component=${Components.join(",")}`, ...Components], {stdio: "pipe"});
}

const CreateSetupFile = (Sign = true, IsTermux = false, Path = "", ...Components) => {
  const ShellScript = [];
  if (IsTermux) ShellScript.push("#!/data/data/com.termux/files/usr/bin/env bash");
  else ShellScript.push("#!/bin/bash");
  ShellScript.push("");
  ShellScript.push(`echo "deb file:${Path} ./" | sudo tee ${IsTermux ? "/data/data/com.termux/files/usr" : ""}/etc/apt/sources.list.d/${Components.join("_")}.list`);
  ShellScript.push("apt-get update");
  ShellScript.push("");
  ShellScript.push("exit 0");
  return ShellScript.join("\n");
}

// Exports
module.exports = {
  AddBranch,
  AddFiles,
  PublishRepo,
  CreateSetupFile
};