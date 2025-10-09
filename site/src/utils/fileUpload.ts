interface UploadParams {
  backendBase?: string | null;
  name: string;
  contentBase64: string;
  purpose?: string;
  contentType?: string;
}

export const uploadSupportFile = async (params: UploadParams): Promise<string> => {
  const { backendBase, name, contentBase64, purpose = "user_data", contentType } = params;
  const endpoint = backendBase
    ? `${backendBase.replace(/\/$/, "")}/api/files/upload`
    : "/api/files/upload";
  const body: Record<string, any> = {
    name,
    contentBase64,
    purpose,
  };
  if (contentType) body.contentType = contentType;

  const response: any = await $fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response || response.status !== "ok" || !response.file?.id) {
    throw new Error("upload_failed");
  }

  return String(response.file.id);
};

