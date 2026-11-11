// The English captions of a scene of the JESUS film, passed on from the Jesus
// Film Project (data/videos.js):
//   GET /video/captions/1_jf6102-0-0  ->  text/vtt
// Their server does not let other pages read the captions (it sends no CORS
// header), and a <track> must be read, so the app fetches them and serves
// them as its own. Only the scenes of JESUS: nothing else is passed on.

const SCENE = /^1_jf61\d\d-0-0$/;

/** @param {{ params: Record<string, string> }} ctx */
export const GET = async ({ params }) => {
  const id = params.id;
  if (!SCENE.test(id)) return new Response('No captions have that address.', { status: 404 });
  const response = await fetch(`https://api-media-core.jesusfilm.org/${id}/editions/ot/subtitles/${id}_ot_529.vtt`).catch(() => null);
  if (!response?.ok) return new Response('The captions could not be had.', { status: 502 });
  return new Response(await response.text(), {
    headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'public, max-age=604800' },
  });
};
