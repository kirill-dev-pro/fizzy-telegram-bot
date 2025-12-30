import { logger } from "./logger";

export const FIZZY_BASE_URL = "https://app.fizzy.do";

// Calculate MD5 checksum for binary content (matching Ruby's implementation)
function calculateMD5Checksum(arrayBuffer) {
  const uint8Array = new Uint8Array(arrayBuffer);
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(uint8Array);
  const hash = hasher.digest();

  // Convert to base64 (strict encoding like Ruby's Base64.strict_encode64)
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// Upload image and get signed_id for embedding in description
async function uploadImageForRichText(config, imageFile) {
  const { account_slug, token } = config;

  try {
    // Step 1: Calculate checksum and size from actual binary content
    const checksum = calculateMD5Checksum(imageFile.content);
    const byteSize = imageFile.content.byteLength;
    const contentType = imageFile.contentType;

    // Step 2: Create direct upload
    const directUploadUrl = `${FIZZY_BASE_URL}/${account_slug}/rails/active_storage/direct_uploads`;
    const directUploadRes = await fetch(directUploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        blob: {
          filename: imageFile.filename,
          byte_size: byteSize,
          checksum: checksum,
          content_type: contentType,
        },
      }),
    });

    if (!directUploadRes.ok) {
      const text = await directUploadRes.text();
      logger.error("Direct upload failed", {
        status: directUploadRes.status,
        error: text,
        account_slug,
        component: "fizzy",
      });
      return {
        success: false,
        error: `Direct upload failed: ${directUploadRes.status} ${text}`,
      };
    }

    const uploadData = await directUploadRes.json();

    // Step 3: Upload the file to storage
    const storageRes = await fetch(uploadData.direct_upload.url, {
      method: "PUT",
      headers: uploadData.direct_upload.headers,
      body: imageFile.content,
    });

    if (!storageRes.ok) {
      const errorText = await storageRes.text();
      logger.error("Storage upload failed", {
        status: storageRes.status,
        error: errorText,
        account_slug,
        filename: imageFile.filename,
        component: "fizzy",
      });
      return {
        success: false,
        error: `Storage upload failed: ${storageRes.status} - ${errorText}`,
      };
    }

    // Construct the blob URL for the attachment
    const blobUrl = `${FIZZY_BASE_URL}/${account_slug}/rails/active_storage/blobs/redirect/${
      uploadData.signed_id
    }/${encodeURIComponent(imageFile.filename)}`;

    logger.info("Image uploaded successfully", {
      account_slug,
      filename: imageFile.filename,
      byteSize: byteSize,
      component: "fizzy",
    });

    return {
      success: true,
      signedId: uploadData.signed_id,
      filename: imageFile.filename,
      contentType: contentType,
      byteSize: byteSize,
      url: blobUrl,
    };
  } catch (err) {
    logger.error("Image upload exception", {
      error: err.message,
      account_slug,
      filename: imageFile.filename,
      component: "fizzy",
    });
    return { success: false, error: err.message };
  }
}

export async function createFizzyCard(
  config,
  title,
  description,
  imageFile = null
) {
  const { account_slug, board_id, token } = config;

  const url = `${FIZZY_BASE_URL}/${account_slug}/boards/${board_id}/cards.json`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let finalDescription = description;

  // If there's an image, embed it in the description
  if (imageFile) {
    const uploadResult = await uploadImageForRichText(config, imageFile);

    if (!uploadResult.success) {
      return {
        success: false,
        error: `Image upload failed: ${uploadResult.error}`,
      };
    }

    // Embed the image at the top of the description using action-text-attachment
    // Include necessary attributes for proper rendering
    const imageAttachment = `<action-text-attachment sgid="${uploadResult.signedId}" content-type="${uploadResult.contentType}" url="${uploadResult.url}" filename="${uploadResult.filename}" filesize="${uploadResult.byteSize}" previewable="true"></action-text-attachment>`;
    finalDescription = `${imageAttachment}<p>${description.replace(
      /\n/g,
      "<br>"
    )}</p>`;
  }

  const body = JSON.stringify({
    card: {
      title,
      description: finalDescription,
    },
  });

  try {
    const res = await fetch(url, { method: "POST", headers, body });
    if (!res.ok) {
      const text = await res.text();
      logger.error("Card creation failed", {
        status: res.status,
        error: text.substring(0, 200),
        account_slug,
        board_id,
        title,
        component: "fizzy",
      });
      return {
        success: false,
        error: `HTTP ${res.status}: ${text.substring(0, 200)}`,
      };
    }
    const location = res.headers.get("Location") || "";
    const cardId = location.match(/cards\/(\d+)/)?.[1];
    const fullUrl = cardId
      ? `${FIZZY_BASE_URL}/${account_slug}/cards/${cardId}`
      : `${FIZZY_BASE_URL}/${account_slug}/boards/${board_id}`;

    logger.info("Card created successfully", {
      account_slug,
      board_id,
      card_id: cardId,
      title,
      has_image: !!imageFile,
      component: "fizzy",
    });

    return { success: true, url: fullUrl };
  } catch (err) {
    logger.error("Card creation exception", {
      error: err.message,
      account_slug,
      board_id,
      title,
      component: "fizzy",
    });
    return { success: false, error: err.message };
  }
}

export async function fetchBoardInfo(config) {
  const { account_slug, board_id, token } = config;
  const url = `${FIZZY_BASE_URL}/${account_slug}/boards/${board_id}.json`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error("Board info fetch failed", {
        status: res.status,
        error: text.substring(0, 200),
        account_slug,
        board_id,
        component: "fizzy",
      });
      return {
        success: false,
        error: `HTTP ${res.status}: ${text.substring(0, 200)}`,
      };
    }

    const data = await res.json();
    logger.info("Board info fetched successfully", {
      account_slug,
      board_id,
      board_name: data.name || "Unnamed Board",
      component: "fizzy",
    });
    return {
      success: true,
      name: data.name || "Unnamed Board",
      id: board_id,
    };
  } catch (err) {
    logger.error("Board info fetch exception", {
      error: err.message,
      account_slug,
      board_id,
      component: "fizzy",
    });
    return { success: false, error: err.message };
  }
}

// Format error message based on status code
export function formatCardError(result, alias, accountSlug) {
  if (result.error.includes("403")) {
    return `Your '${alias}' (${accountSlug}) account doesn't have access to this board.\n\nTry /select_account or check permissions on fizzy.do`;
  } else if (result.error.includes("401")) {
    return `Token '${alias}' (${accountSlug}) is invalid or expired.\n\nPlease update it in private chat with /config_token`;
  } else if (result.error.includes("404")) {
    return `Board not found. The board ID might be incorrect or was deleted.\n\nUsed account: ${alias} (${accountSlug})`;
  } else {
    return `Failed: ${result.error}\n\nUsed account: ${alias} (${accountSlug})`;
  }
}
