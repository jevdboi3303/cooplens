export function Privacy() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        Coop<span className="text-blue-500">Lens</span> Privacy Policy
      </h1>
      <p className="text-zinc-500 text-sm mb-10">Last updated: June 5, 2026</p>

      <section className="space-y-8 text-sm leading-relaxed text-zinc-300">
        <div>
          <h2 className="text-lg font-semibold text-white mb-2">What CoopLens collects</h2>
          <ul className="space-y-2 list-disc list-inside text-zinc-400">
            <li><strong className="text-zinc-200">Email address</strong> — used to create your account via Supabase authentication</li>
            <li><strong className="text-zinc-200">Resume text</strong> — uploaded as a PDF, parsed to extract skills, stored securely to power CV matching scores</li>
            <li><strong className="text-zinc-200">Job posting content</strong> — text from postings you open on learninginmotion.uvic.ca is sent to our backend for scoring and is not stored permanently</li>
            <li><strong className="text-zinc-200">Score history</strong> — posting IDs, titles, companies, and scores stored locally in your browser (chrome.storage)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">What CoopLens does NOT collect</h2>
          <ul className="space-y-2 list-disc list-inside text-zinc-400">
            <li>We do not collect your UVic NetLink credentials</li>
            <li>We do not read or store pages outside of learninginmotion.uvic.ca</li>
            <li>We do not sell, share, or monetise your data</li>
            <li>We do not use your data for advertising</li>
            <li>We do not execute remotely hosted code — all extension logic is bundled locally</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">Permissions explained</h2>
          <ul className="space-y-2 list-disc list-inside text-zinc-400">
            <li><strong className="text-zinc-200">storage</strong> — saves your auth token, resume skills, score history, and watchlist locally on your device</li>
            <li><strong className="text-zinc-200">alarms</strong> — checks watchlisted job deadlines every 6 hours to send timely reminders</li>
            <li><strong className="text-zinc-200">notifications</strong> — alerts you when a watched posting deadline is within 3 days</li>
            <li><strong className="text-zinc-200">host permissions (learninginmotion.uvic.ca)</strong> — reads job posting content to generate scores inline on the portal</li>
            <li><strong className="text-zinc-200">host permissions (cooplens-production.up.railway.app)</strong> — sends posting text and resume to our scoring API</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">Third-party services</h2>
          <ul className="space-y-2 list-disc list-inside text-zinc-400">
            <li><strong className="text-zinc-200">Supabase</strong> — stores account and resume data. <a href="https://supabase.com/privacy" className="text-blue-400 hover:underline">Privacy Policy</a></li>
            <li><strong className="text-zinc-200">Groq</strong> — job descriptions are sent to Groq's API (Llama 3.3 70B) for scoring. Groq does not train on API data. <a href="https://groq.com/privacy-policy/" className="text-blue-400 hover:underline">Privacy Policy</a></li>
            <li><strong className="text-zinc-200">Railway</strong> — hosts the backend API. <a href="https://railway.app/legal/privacy" className="text-blue-400 hover:underline">Privacy Policy</a></li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">Data retention</h2>
          <p className="text-zinc-400">Your resume and account data are retained until you delete your account. Score history stored in your browser is cleared when you uninstall the extension. You can request deletion of all server-side data by emailing <a href="mailto:harsadh32@gmail.com" className="text-blue-400">harsadh32@gmail.com</a>.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
          <p className="text-zinc-400">For any privacy questions: <a href="mailto:harsadh32@gmail.com" className="text-blue-400">harsadh32@gmail.com</a></p>
        </div>
      </section>
    </div>
  );
}
