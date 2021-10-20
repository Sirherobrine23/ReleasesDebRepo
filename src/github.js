const request = require("../lib/request");

// Github.com API
async function Github_com (username = "", repo = "", token = "", list_size = 30) {
  const url = `https://api.github.com/repos/${username}/${repo}/releases?per_page=${list_size}`;
  const FetchOPtions = {};
  if (token) {
    FetchOPtions.headers = {
      Authorization: `token ${token}`
    };
  }
  try {
    console.log(url);
    const GetListArray = await request.Json(url, FetchOPtions);
    let ParseUserList = [
      {
        tag_name: "",
        file_name: "",
        file_size: 0,
        file_url: ""
      }
    ];
    ParseUserList = [];

    for (let Tag of GetListArray) {
      for (let File of Tag.assets) {
        if (File.name.endsWith(".deb")) {
          if (File.browser_download_url) {
            ParseUserList.push({
              tag_name: Tag.tag_name,
              file_name: File.name,
              file_size: File.size,
              file_url: File.browser_download_url
            });
          }
        }
      }
    }

    return ParseUserList;
  } catch (err) {
    console.log(err);
    return [];
  }
}

// Enterprise API
async function Enterprise (username = "", repo = "", token = "", list_size = 5, API_HOST = "") {
  const url = `https://${API_HOST}/repos/${username}/${repo}/release?per_page=${list_size}`;
  const FetchOPtions = {};
  if (token) {
    FetchOPtions.headers = {
      Authorization: `token ${token}`
    };
  }
  try {
    const GetListArray = await request.Json(url, FetchOPtions);
    let ParseUserList = [
      {
        tag_name: "",
        file_name: "",
        file_size: 0,
        file_url: ""
      }
    ];
    ParseUserList = [];

    for (let Tag of GetListArray) {
      for (let File of Tag.assets) {
        if (File.name.endsWith(".deb")) {
          if (File.browser_download_url) {
            ParseUserList.push({
              tag_name: Tag.tag_name,
              file_name: File.name,
              file_size: File.size,
              file_url: File.browser_download_url
            });
          }
        }
      }
    }

    return ParseUserList;
  } catch (err) {
    console.log(err);
    return [];
  }
}

// Export
module.exports = {
  Github_com,
  Enterprise
};