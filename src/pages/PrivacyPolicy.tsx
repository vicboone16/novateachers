import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const EFFECTIVE = 'September 1, 2025';
  const CONTACT = 'privacy@novatrack.app';

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <h1 className="text-3xl font-bold font-heading mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective date: {EFFECTIVE}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold mb-2">1. Who We Are</h2>
            <p>NovaTrack Teacher Hub ("NovaTrack", "we", "us", or "our") is a special-education data platform designed for teachers, behavior analysts, and support staff. Our registered address is on file with Apple Inc. and available upon request at {CONTACT}.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
            <p>We collect only the information necessary to provide our services:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Account data:</strong> email address and password hash (via Supabase Auth)</li>
              <li><strong>Professional data:</strong> agency / school name, classroom names, staff display name</li>
              <li><strong>Student data:</strong> first name and last initial (no full names required), behavioral data points, IEP goal summaries, and data-collection session records entered by the authorized teacher</li>
              <li><strong>Usage data:</strong> anonymized analytics to improve the app (no third-party advertising trackers)</li>
              <li><strong>Device data:</strong> push-notification token if you enable notifications (optional)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To operate and deliver the app's features (data collection, IEP tools, behavior tracking)</li>
              <li>To send in-app and push notifications you explicitly enable</li>
              <li>To respond to support requests</li>
              <li>To comply with applicable law (FERPA, IDEA, HIPAA as applicable)</li>
            </ul>
            <p className="mt-2">We do <strong>not</strong> sell, rent, or share student data with advertisers or data brokers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Student Data and FERPA / COPPA</h2>
            <p>NovaTrack is designed for use by education professionals with students. We treat all student records as educational records under FERPA. We do not knowingly collect personal information from children under 13 directly; all student data is entered by authenticated staff members.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Data Storage and Security</h2>
            <p>Data is stored on Supabase-hosted PostgreSQL databases (AWS us-east-1). All data is encrypted at rest and in transit using TLS 1.2+. Row-level security policies restrict each user's access to their own agency's data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Data Retention</h2>
            <p>Account data is retained while your account is active and for 30 days after deletion. Student behavioral records may be exported by the teacher at any time and are deleted upon account closure or upon request.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Your Rights</h2>
            <p>Depending on your jurisdiction you may have the right to access, correct, export, or delete your data. To exercise any right, email {CONTACT}. We respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Third-Party Services</h2>
            <p>We use the following sub-processors:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Supabase</strong> — database, auth, storage (supabase.com/privacy)</li>
              <li><strong>Google Gemini</strong> — AI processing for IEP drafting (data is not stored by Google for model training under our terms)</li>
              <li><strong>Apple Push Notification service</strong> — optional notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Changes to This Policy</h2>
            <p>We will notify users of material changes via in-app notice at least 14 days before the change takes effect.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Contact Us</h2>
            <p>Privacy questions: <a href={`mailto:${CONTACT}`} className="text-primary underline">{CONTACT}</a></p>
          </section>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">© {new Date().getFullYear()} NovaTrack Teacher Hub. All rights reserved.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
