import { storage } from "@/config/firebase";
import { ref, getDownloadURL, listAll } from "firebase/storage";
import { NextResponse } from "next/server";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function GET() {
  try {
    const listRef = ref(storage, "coupons");
    const res = await listAll(listRef);

    const files = await Promise.all(
      res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          url: url,
        };
      }),
    );

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching files from Firebase Storage:", error);
    return NextResponse.json(
      { error: "Error fetching files from Firebase Storage" },
      { status: 500 },
    );
  }
}
