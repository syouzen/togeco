import { storage } from "@/config/firebase";
import { randomUUID } from "crypto";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { NextRequest, NextResponse } from "next/server";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const uuid = randomUUID();
    const fileExtension = file.name.split(".").pop() || "";
    const filename = fileExtension ? `${uuid}.${fileExtension}` : uuid;

    const storageRef = ref(storage, `coupons/${filename}`);

    const buffer = await file.arrayBuffer();

    const snapshot = await uploadBytes(storageRef, buffer, {
      contentType: file.type,
    });

    const downloadURL = await getDownloadURL(snapshot.ref);

    return NextResponse.json({
      message: "File uploaded successfully",
      filename,
      url: downloadURL,
      path: snapshot.ref.fullPath,
    });
  } catch (error) {
    console.error("Error uploading file to Firebase Storage:", error);
    return NextResponse.json(
      { error: "Error uploading file to Firebase Storage" },
      { status: 500 },
    );
  }
}
