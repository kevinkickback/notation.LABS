import { type DemoVideo, db } from './schema';

export const demoVideos = {
  get: async (id: string) => db.demoVideos.get(id),
  add: async (video: DemoVideo) => {
    await db.demoVideos.add(video);
    return video.id;
  },
  delete: async (id: string) => db.demoVideos.delete(id),
  getAll: () => db.demoVideos.toArray(),
  getBlobUrl: async (id: string) => {
    const video = await db.demoVideos.get(id);
    if (!video) return null;
    const blob = new Blob([video.data], { type: video.mimeType });
    return URL.createObjectURL(blob);
  },
};
