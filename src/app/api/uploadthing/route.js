import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

const getUploadthingConfig = (branchId, appId) => {
  if (String(branchId) === "2" || appId === "7r7c84t2zj") {
    return { token: process.env.UPLOADTHING_TOKEN_2 };
  }
  return { token: process.env.UPLOADTHING_TOKEN_1 };
};

export async function POST(req) {
  const branchId = req.headers.get("x-branch-id");
  let appId = null;

  // UploadThing's callback webhook doesn't include custom frontend headers.
  // We can extract the appId from the callback body to determine the branch.
  if (!branchId) {
    try {
      const clonedReq = req.clone();
      const body = await clonedReq.json();
      
      if (body?.file?.appUrl) {
        // e.g. https://utfs.io/a/7r7c84t2zj/... -> 7r7c84t2zj
        const parts = body.file.appUrl.split('/a/');
        if (parts.length > 1) {
          appId = parts[1].split('/')[0];
        }
      } else if (body?.file?.ufsUrl) {
        // e.g. https://7r7c84t2zj.ufs.sh/... -> 7r7c84t2zj
        const match = body.file.ufsUrl.match(/https?:\/\/([^.]+)\.ufs\.sh/);
        if (match) {
          appId = match[1];
        }
      }
    } catch (e) {
      console.error("Failed to parse callback body for appId:", e);
    }
  }

  const config = getUploadthingConfig(branchId, appId);
  
  const handler = createRouteHandler({
    router: ourFileRouter,
    config: { token: config.token },
  });
  
  return handler.POST(req);
}

export async function GET(req) {
  const branchId = req.headers.get("x-branch-id");
  const config = getUploadthingConfig(branchId, null);
  
  const handler = createRouteHandler({
    router: ourFileRouter,
    config: { token: config.token },
  });
  
  return handler.GET(req);
}
