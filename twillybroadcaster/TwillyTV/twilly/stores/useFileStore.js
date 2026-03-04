import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useFileStore = defineStore('files', () => {
  const files = ref([]);
  const folders = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const currentFolder = ref('default');

  // Computed properties for different file types
  const videos = computed(() => 
    files.value.filter(file => file.category === 'Videos')
  );
  
  const images = computed(() => 
    files.value.filter(file => file.category === 'Images')
  );
  
  const audios = computed(() => 
    files.value.filter(file => file.category === 'Audios')
  );
  
  const docs = computed(() => 
    files.value.filter(file => file.category === 'Docs')
  );

  // Add computed properties for category-specific folders
  const categoryFolders = computed(() => {
    return (category) => {
      if (!folders.value) return [];
      
      const filtered = folders.value.filter(folder => {
        // Check if folder has correct category and is not deleted
        return folder && folder.category === category && folder.type === 'folder';
      });
      return filtered;
    };
  });

  // Filter files by category and current folder
  const filteredFiles = (category) => {
    if (!category) return [];
    return files.value.filter(file => {
      // Basic category and folder check
      const matchesCategory = file?.category?.toLowerCase() === category?.toLowerCase();
      const isNotFolder = !file.isFolder;
      
      // Special handling for GIF files in Images category
      if (category === 'Images' && file?.fileName?.endsWith('.gif')) {
        // Only show GIF files that are actual thumbnails (have parentVideoSK)
        return matchesCategory && 
               isNotFolder && 
               currentFolder.value === 'thumbnails' && 
               file.parentVideoSK;
      }
      
      // For all other files
      return matchesCategory && 
             isNotFolder && 
             (
               // Show in default folder if:
               // 1. folderName is 'default'
               // 2. no folderName exists
               // 3. folderName is null or undefined
               (currentFolder.value === 'default' && 
                 (file.folderName === 'default' || 
                  !file.folderName || 
                  file.folderName === null || 
                  file.folderName === undefined)
               ) ||
               // Show in specific folder if folderName matches exactly
               (currentFolder.value !== 'default' && 
                file.folderName === currentFolder.value)
             );
    });
  };

  // Set current folder
  const setCurrentFolder = (folderName) => {
    currentFolder.value = folderName;
  };

  // Fetch files from API
  const getFiles = async (userId) => {
    loading.value = true;
    error.value = null;
    
    try {
      console.log('🔍 fileStore.getFiles called with userId:', userId);
      const response = await fetch(`/api/files/${userId}`);
      console.log('🔍 API response status:', response.status);
      
      if (!response.ok) throw new Error('Failed to fetch files');
      
      const data = await response.json();
      console.log('🔍 Raw API response data:', data);
      console.log('🔍 data.listings length:', data.listings?.length);
      console.log('🔍 data.folders length:', data.folders?.length);
      
      // Filter out folders from files array
      const filteredFiles = (data.listings || [])
        .filter(item => !item.isFolder);
      
      console.log('🔍 Filtered files length:', filteredFiles.length);
      console.log('🔍 First few filtered files:', filteredFiles.slice(0, 3));
      
      files.value = filteredFiles.map(file => file);
      
      // Filter and format folders
      const fetchedFolders = (data.folders || [])
        .filter(folder => 
          folder.SK && 
          folder.SK.startsWith('FOLDER#') && 
          folder.isFolder
        );
      
      // Ensure folders are properly set
      folders.value = fetchedFolders;
      
      console.log('🔍 Final files.value length:', files.value.length);
      console.log('🔍 Final folders.value length:', folders.value.length);
      
    } catch (err) {
      console.error('Error fetching files:', err);
      error.value = err.message;
      folders.value = []; // Reset folders on error
    } finally {
      loading.value = false;
    }
  };

  // Add to your store actions
  const removeFile = (fileId) => {
    files.value = files.value.filter(file => file.SK !== fileId);
  };

  // Update create folder method
  const createFolder = async (userId, folderName, category = 'Mixed', trailerUrl = null) => {
    try {
      // Create folder with consistent SK format for all categories
      const folderItem = {
        PK: `USER#${userId}`,
        SK: `FOLDER#${category}#${folderName}`,  // Always use category in SK
        name: folderName,
        category: category,
        type: 'folder',
        isFolder: true,
        createdAt: new Date().toISOString(),
        trailerUrl: trailerUrl
      };

      const response = await fetch('/api/folders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          folderName,
          category,
          SK: `FOLDER#${category}#${folderName}`,  // Ensure consistent SK format
          trailerUrl: trailerUrl
        }),
      });

      if (!response.ok) throw new Error('Failed to create folder');

      // Add to local state
      folders.value.push(folderItem);
      
      return folderItem;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  };

  // Move file to different folder
  const moveFile = async (userId, fileId, targetFolder) => {
    try {
      // Verify file exists before attempting move
      const fileToMove = files.value.find(f => f.SK === fileId);
      if (!fileToMove) {
        throw new Error('File not found');
      }

      const response = await fetch('/api/files/move', {
        method: 'POST',
        body: JSON.stringify({ 
          userId, 
          fileId, 
          targetFolder,
          category: fileToMove.category
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to move file');
      }

      // Parse the response
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to move file');
      }

      // Update local state only after successful server update
      files.value = files.value.map(file => {
        if (file.SK === fileId) {
          return { ...file, folderName: targetFolder };
        }
        if (file.parentVideoSK === fileId) {
          return { ...file, folderName: targetFolder };
        }
        return file;
      });

    } catch (err) {
      console.error('Error moving file:', err);
      throw err;
    }
  };

  // Add this new method
  const deleteFolder = async (userId, folderName, category = 'Mixed') => {
    try {
      
      const response = await fetch('/api/folders/delete', {
        method: 'POST',
        body: JSON.stringify({ userId, folderName, category }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      // Remove folder from local state
      folders.value = folders.value.filter(folder => folder.name !== folderName);
      
      // Refresh files to ensure UI is updated
      await getFiles(userId);
      
    } catch (err) {
      console.error('Error deleting folder:', err);
      throw err;
    }
  };

  // Add this method to the store
  const updateFolderMetadata = async (userId, folderName, category, metadata) => {
    try {
      // Construct the folder sort key (SK)
      const folderSK = `FOLDER#${category}#${folderName}`;

      // Update DynamoDB
      const response = await $fetch('/api/folders/updateMetadata', {
        method: 'POST',
        body: {
          userId,
          folderName,
          category,
          metadata: {
            seriesPosterUrl: metadata.seriesPosterUrl || ''
          }
        }
      });

      // Refresh folders from the server
      await getFiles(userId);

      return response;
    } catch (error) {
      console.error('Error updating folder metadata:', error);
      throw error;
    }
  };

  return {
    files,
    folders,
    loading,
    error,
    currentFolder,
    videos,
    images,
    audios,
    docs,
    filteredFiles,
    setCurrentFolder,
    getFiles,
    removeFile,
    createFolder,
    moveFile,
    deleteFolder,
    categoryFolders,
    updateFolderMetadata
  };
});

function getDefaultThumbnail() {
  return 'https://d4idc5cmwxlpy.cloudfront.net/No_Image_Available.jpg';
}
