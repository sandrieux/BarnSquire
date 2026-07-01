import * as ImagePicker from "expo-image-picker";
import DocumentScanner from "react-native-document-scanner-plugin";
import { fileSize } from "./api";

// A file staged for upload to the ledger (camera photo, library image, or scan).
export interface PendingAttachment {
  uri: string;
  fileName: string;
  mimeType: string; // must be one of image/jpeg, image/png, application/pdf
  sizeBytes: number;
}

function fileNameFromUri(uri: string, fallback: string): string {
  const last = uri.split("/").pop();
  return last && last.includes(".") ? last : fallback;
}

export async function pickPhotoFromCamera(): Promise<PendingAttachment | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 });
  const asset = res.canceled ? null : res.assets?.[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? fileNameFromUri(asset.uri, `photo-${Date.now()}.jpg`),
    mimeType: asset.mimeType === "image/png" ? "image/png" : "image/jpeg",
    sizeBytes: asset.fileSize ?? (await fileSize(asset.uri)),
  };
}

export async function pickPhotoFromLibrary(): Promise<PendingAttachment | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
  const asset = res.canceled ? null : res.assets?.[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? fileNameFromUri(asset.uri, `photo-${Date.now()}.jpg`),
    mimeType: asset.mimeType === "image/png" ? "image/png" : "image/jpeg",
    sizeBytes: asset.fileSize ?? (await fileSize(asset.uri)),
  };
}

// Native document scanner (edge detection / crop). Emits one or more JPEGs.
export async function scanDocument(): Promise<PendingAttachment[]> {
  const { scannedImages } = await DocumentScanner.scanDocument({ maxNumDocuments: 5 });
  if (!scannedImages?.length) return [];
  return Promise.all(
    scannedImages.map(async (uri) => ({
      uri,
      fileName: fileNameFromUri(uri, `scan-${Date.now()}.jpg`),
      mimeType: "image/jpeg",
      sizeBytes: await fileSize(uri),
    })),
  );
}
