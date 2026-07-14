import { NextResponse } from 'next/server';
import { UTApi } from "uploadthing/server";

const getUploadthingConfig = (branchId) => {
  if (String(branchId) === "2") {
    return { token: process.env.UPLOADTHING_TOKEN_2 };
  }
  return { token: process.env.UPLOADTHING_TOKEN_1 };
};

export async function POST(req) {
  try {
    const body = await req.json();
    const { fileUrl, branchId } = body;

    if (!fileUrl) {
      return NextResponse.json({ error: "No fileUrl provided" }, { status: 400 });
    }

    // Extract the fileKey from the URL
    let fileKey = "";
    const parts = fileUrl.split('/f/');
    if (parts.length > 1) {
      fileKey = parts[1];
    } else {
       return NextResponse.json({ error: "Invalid fileUrl format" }, { status: 400 });
    }

    const config = getUploadthingConfig(branchId);
    const utapi = new UTApi({ token: config.token });

    await utapi.deleteFiles(fileKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file from UploadThing:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
