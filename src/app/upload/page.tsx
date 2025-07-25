"use client";

import Uppy from "@uppy/core";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import Korean from "@uppy/locales/lib/ko_KR";
import Dashboard from "@uppy/react/lib/Dashboard";
import Xhr from "@uppy/xhr-upload";
import { useState } from "react";

function createUppy() {
  return new Uppy({
    locale: Korean,
    restrictions: {
      allowedFileTypes: ["image/jpeg", "image/png", "image/jpg"],
      maxFileSize: 10 * 1024 * 1024, // 10MB 제한
      maxNumberOfFiles: 5,
    },
  })
    .use(Xhr, {
      endpoint: "/api/upload",
      fieldName: "file",
    })
    .on("upload-success", (file, response) => {
      console.log("업로드 성공:", file?.name, response.body);

      if (response.body?.url) {
        console.log("Firebase Storage URL:", response.body.url);
      }
    })
    .on("upload-error", (file, error) => {
      console.error("업로드 실패:", file?.name, error);
    })
    .on("complete", (result) => {
      if (result.successful && result.successful.length > 0) {
        console.log("모든 업로드 완료:", result.successful.length, "개 파일");
      }
    });
}

export default function UppyDashboard() {
  const [uppy] = useState(createUppy);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <Dashboard
        width="100%"
        height={500}
        theme="dark"
        uppy={uppy}
        showProgressDetails={true}
        proudlyDisplayPoweredByUppy={false}
        note="이미지만 업로드 가능합니다 (JPEG, PNG, JPG) - 최대 10MB, 5개 파일"
      />
    </div>
  );
}
