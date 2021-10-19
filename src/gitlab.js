const request = require("../lib/request");

// Gitlab Release API
async function getRelease(projectId = "", Token = "") {
  try {
    const ApiUrl = `https://gitlab.com/api/v4/projects/${projectId}/releases`;
    const ApiReleases = await request.Json(ApiUrl, {
      headers: {
        "PRIVATE-TOKEN": Token,
      }
    });

    let ParseUserList = [
      {
        tag_name: "",
        file_name: "",
        file_size: 0,
        file_url: ""
      }
    ];
    ParseUserList = [];
    console.log("Gitlab Release Dropead:", ApiReleases)
    return ParseUserList;
  } catch (err) {
    console.log(err);
    return [];
  }
}

// Export
module.exports = {
  getRelease
};