import { runCors } from '../lib/cors';
import { getAuthenticatedAdmin } from '../lib/middleware';
import { getSupabase } from '../lib/db';

export default async function handler(req: any, res: any) {
  if (!runCors(req, res)) return;

  const admin = await getAuthenticatedAdmin(req, res);
  if (!admin) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: "Supabase environment variables are missing" });

  try {
    if (req.method === 'POST') {
      const demoJobs = [
        {
          id: `job-demo-1`,
          title: "Senior Full Stack Engineer",
          company: "TechFlow Systems",
          location: "San Francisco, CA (Remote)",
          category: "Software Engineering",
          type: "Full-Time",
          salary: "$150k - $200k",
          description: "We are looking for a senior engineer to join our core platform team...",
          requirements: JSON.stringify(["React", "Node.js", "TypeScript", "PostgreSQL"]),
          postedAt: new Date().toISOString()
        },
        {
          id: `job-demo-2`,
          title: "Product Marketing Manager",
          company: "GrowthLabs",
          location: "New York, NY",
          category: "Marketing",
          type: "Full-Time",
          salary: "$120k - $160k",
          description: "Lead our product marketing efforts for the next generation of AI tools...",
          requirements: JSON.stringify(["SEO", "Content Strategy", "Product Launch", "Market Research"]),
          postedAt: new Date().toISOString()
        }
      ];

      const { error } = await supabase.from('jobs').upsert(demoJobs);
      if (error) throw error;

      return res.status(200).json({ message: "Demo data seeded successfully (Jobs only for now)." });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
