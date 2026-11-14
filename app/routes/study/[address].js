// A study of a passage, as JSON, for the table to lay out (bible-table
// startStudy, lib/study.js):
//   GET /study/MAT.1.23  ->  { "address": "MAT.1.23", "quotations": ["ISA.7.14"], ... }

import { studyPlan } from '../../data/study.js';

/** @param {{ params: Record<string, string> }} ctx */
export const GET = async ({ params }) => {
  const plan = await studyPlan(params.address);
  if (!plan) return new Response('There is no study for that address.', { status: 404 });
  return Response.json(plan, { headers: { 'Cache-Control': 'public, max-age=3600' } });
};
