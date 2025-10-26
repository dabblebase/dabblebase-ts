/** Client containing functionality to interact with Dabblebase Storage */
export type DabblebaseStorageClient = {
  /**
   * Uploads a file to Dabblebase Storage at the specified path.
   *
   * @example
   * Here is an example of using the storage client to upload a file on the client side:
   * ```ts
   * const result = await dabblebase.storage.upload({
   *   file: selectedFile,
   *   path: "uploads/my-image.jpg",
   * });
   * ```
   * @param options - upload options.
   * - file: the File object to upload
   * - path: the destination path in the storage bucket
   *
   * @returns an object containing the URL to access the uploaded file. This URL may be
   * stored elsewhere (such as in the database) for later retrieval.
   */
  upload(options: { file: File; path: string }): Promise<{ url: string }>;

  /**
   * Generates a URL to view a file stored in Dabblebase Storage at the specified path.
   *
   * @example
   * Here is an example of using the storage client to get a view URL for a file:
   * ```ts
   * const viewUrl = dabblebase.storage.getUrl("uploads/my-image.jpg");
   *
   * @remark
   * This function is not asynchronous and does not perform any network requests - it simply
   * constructs the URL based on the provided path.
   *
   * ```
   * @param path - the path of the file in the storage bucket
   *
   * @returns a string URL that can be used to view or download the file.
   */
  getUrl(path: string): string;

  /**
   * Lists all files stored in Dabblebase Storage for the current project.
   *
   * @example
   * Here is an example of using the storage client to list all files:
   * ```ts
   * const result = await dabblebase.storage.list();
   * console.log(result.files);
   * ```
   *
   * @returns an object containing an array of file metadata.
   */
  list(): Promise<{
    files: Array<{
      key: string;
      path: string;
      size: number;
      last_modified: string;
    }>;
  }>;

  /**
   * Deletes a file stored in Dabblebase Storage at the specified path.
   *
   * @example
   * Here is an example of using the storage client to delete a file:
   * ```ts
   * await dabblebase.storage.delete({ path: "uploads/my-image.jpg" });
   * ```
   * @param options - delete options.
   */
  delete(options: { path: string }): Promise<void>;
};

/** Configuration for the Dabblebase Storage client */
export type StorageClientConfiguration = {
  projectId: string;
  dabblebaseUrl: string;
  projectToken?: string;
};

/** Generates the Dabblebase Storage client based on the provided configuration */
export function createStorageClient({
  projectId,
  dabblebaseUrl,
  projectToken,
}: StorageClientConfiguration): DabblebaseStorageClient {
  // Helper function that returns headers with the project verification token if provided.
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (projectToken) {
      headers["X-Project-Token"] = projectToken;
    }

    return headers;
  };

  return {
    async upload({ file, path }) {
      // Validate inputs to the upload function
      if (!file) {
        throw new Error("❌ (dabblebase): A file must be provided for upload.");
      }
      if (!path) {
        throw new Error(
          "❌ (dabblebase): A destination path must be provided for upload."
        );
      }

      // Create form data for the file upload. This is necessary for sending files via fetch.
      const formData = new FormData();
      formData.append("file", file);

      // Encode the path for URL safety
      const encodedPath = encodeURIComponent(path);

      // Perform the file upload via a POST request to the Dabblebase Storage upload endpoint
      const response = await fetch(
        `${dabblebaseUrl}/api/project/${projectId}/storage/upload?path=${encodedPath}`,
        {
          method: "POST",
          headers: {
            // Don't set Content-Type - let browser set it with boundary for FormData
            "X-Project-Token": projectToken || "",
          },
          body: formData,
        }
      );

      // Handle response errors from the upload request, if any
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `❌ (dabblebase): Direct upload failed (${response.status} ${response.statusText}). ${errorText}`
        );
      }

      // Parse the response JSON to get the result and return the file URL
      const result = await response.json();
      return { url: `${dabblebaseUrl}${result.url}` };
    },
    async list() {
      // Fetch the list of files via a GET request to the Dabblebase Storage list endpoint
      const response = await fetch(
        `${dabblebaseUrl}/api/project/${projectId}/storage/list`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );

      // Handle response errors from the list request, if any
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `❌ (dabblebase): Failed to list files (${response.status} ${response.statusText}). ${errorText}`
        );
      }

      // Parse and return the response JSON containing the list of files
      return await response.json();
    },
    getUrl(path: string): string {
      // Validate input to the getUrl function
      if (!path) {
        throw new Error(
          "❌ (dabblebase): A path must be provided for view URL."
        );
      }

      // Encode the path for URL safety
      const encodedPath = path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

      // Construct and return the full URL to view the file, including the project verification token if provided
      return `${dabblebaseUrl}/api/project/${projectId}/storage/view/${encodedPath}?X-Project-Token=${encodeURIComponent(
        projectToken || ""
      )}`;
    },
    async delete({ path }) {
      // Validate input to the delete function
      if (!path) {
        throw new Error(
          "❌ (dabblebase): A destination path must be provided for deletion."
        );
      }

      // Encode the path for URL safety
      const encodedPath = encodeURIComponent(path);

      // Perform the file deletion via a DELETE request to the Dabblebase Storage delete endpoint
      const response = await fetch(
        `${dabblebaseUrl}/api/project/${projectId}/storage/delete?path=${encodedPath}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      // Handle response errors from the delete request, if any
      if (!response.ok) {
        throw new Error(
          `❌ (dabblebase): Failed to delete the file (${response.status} ${response.statusText}).`
        );
      }
    },
  };
}
