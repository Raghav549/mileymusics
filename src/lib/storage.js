import { supabase } from './auth.js';

export const storage = {
  async upload(bucket, path, file, options = {}) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          contentType: options.contentType || file.type,
          upsert: options.upsert || false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return {
        path: data.path,
        publicUrl,
        fullPath: data.fullPath,
      };
    } catch (error) {
      console.error(`Upload to ${bucket} error:`, error);
      throw error;
    }
  },

  async download(bucket, path) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Download from ${bucket} error:`, error);
      throw error;
    }
  },

  async delete(bucket, paths) {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      const { data, error } = await supabase.storage
        .from(bucket)
        .remove(pathArray);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Delete from ${bucket} error:`, error);
      throw error;
    }
  },

  async list(bucket, prefix = '') {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(prefix, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`List files from ${bucket} error:`, error);
      throw error;
    }
  },

  async getPublicUrl(bucket, path) {
    try {
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      return publicUrl;
    } catch (error) {
      console.error(`Get public URL error:`, error);
      throw error;
    }
  },

  // Helper methods for specific buckets
  async uploadAvatar(file, userId) {
    const timestamp = Date.now();
    const path = `avatars/${userId}/${timestamp}-${file.name}`;
    return this.upload('avatars', path, file);
  },

  async uploadCover(file, userId) {
    const timestamp = Date.now();
    const path = `covers/${userId}/${timestamp}-${file.name}`;
    return this.upload('covers', path, file);
  },

  async uploadSong(file, userId) {
    const timestamp = Date.now();
    const path = `songs/${userId}/${timestamp}-${file.name}`;
    return this.upload('songs', path, file);
  },

  async uploadThumbnail(file, userId) {
    const timestamp = Date.now();
    const path = `thumbnails/${userId}/${timestamp}-${file.name}`;
    return this.upload('thumbnails', path, file);
  },
};

export default storage;
