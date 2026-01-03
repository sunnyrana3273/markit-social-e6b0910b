import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Book, Mail, Globe } from "lucide-react";
import { useForceLightMode } from "@/hooks/useForceLightMode";

const Privacy = () => {
  useForceLightMode();

  useEffect(() => {
    document.title = "MarkIt | Privacy Policy";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-home-background font-lexend force-light-mode">
      {/* Header */}
      <header className="border-b border-gray-200 bg-home-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5">
            <div className="w-8 h-8 flex items-center justify-center">
              <Book className="w-5 h-5 text-home-primary" />
            </div>
            <span className="text-xl font-bold text-home-foreground">MarkIt</span>
          </Link>
          
          <Link to="/">
            <Button variant="ghost" className="text-home-foreground hover:bg-home-surface">
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Privacy Policy Content */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-12">
              <h1 className="text-4xl lg:text-5xl font-bold text-home-foreground mb-4">
                MarkIt:Privacy Policy
              </h1>
              <p className="text-lg text-gray-600">
                Last updated: January 2nd, 2026
              </p>
            </div>

            {/* Introduction */}
            <div className="prose prose-lg max-w-none mb-12">
              <p className="text-gray-700 leading-relaxed">
                MarkIt ("MarkIt," "we," "us," or "our") values your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use our website, mobile apps, and services (collectively, the "Service").
              </p>
              <p className="text-gray-700 leading-relaxed font-semibold">
                By using MarkIt, you agree to the practices described below.
              </p>
            </div>

            {/* Section 1 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">1. Information We Collect</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-home-foreground mb-3">a. Information You Provide</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    We may collect information you choose to provide, including:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                    <li>Name, username, email address</li>
                    <li>Profile details (grade level, courses, preferences)</li>
                    <li>Messages, chat content, whiteboard inputs, and study room activity</li>
                    <li>Files, images, or text you upload for AI assistance</li>
                    <li>Feedback, support requests, or survey responses</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-home-foreground mb-3">b. Automatically Collected Information</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    When you use MarkIt, we may automatically collect:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                    <li>Device type, browser, and operating system</li>
                    <li>IP address and general location (city/state level)</li>
                    <li>Usage data (features used, session duration, interactions)</li>
                    <li>Cookies or similar technologies for analytics and performance</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-home-foreground mb-3">c. Voice & Real-Time Features</h3>
                  <p className="text-gray-700 leading-relaxed mb-3">
                    If you use voice calls or live collaboration, we may process:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                    <li>Real-time audio streams (not stored by default)</li>
                    <li>Call metadata (duration, participants)</li>
                  </ul>
                  <p className="text-gray-700 leading-relaxed mt-3 italic">
                    We do not record calls unless explicitly stated and consented to.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">2. How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We use your information to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-4">
                <li>Provide and improve MarkIt's features</li>
                <li>Power AI-assisted learning tools and contextual help</li>
                <li>Enable collaboration, chat, and study rooms</li>
                <li>Personalize your learning experience</li>
                <li>Monitor usage for safety, abuse prevention, and moderation</li>
                <li>Communicate updates, security notices, or support responses</li>
              </ul>
              <p className="text-gray-700 leading-relaxed font-semibold">
                We do not sell your personal data.
              </p>
            </div>

            {/* Section 3 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">3. AI & Educational Data Use</h2>
              <ul className="list-disc list-inside space-y-3 text-gray-700 ml-4">
                <li>Inputs you provide to AI features may be processed to generate responses.</li>
                <li>AI outputs are not guaranteed to be correct and should be verified.</li>
                <li>We may use anonymized and aggregated data to improve system performance.</li>
                <li>We do not train public models on private user content without permission.</li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">4. Data Sharing</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may share data only:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-4">
                <li>With trusted service providers (hosting, analytics, moderation tools)</li>
                <li>If required by law or legal process</li>
                <li>To protect the safety, rights, or integrity of users or MarkIt</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                All partners are required to maintain reasonable security standards.
              </p>
            </div>

            {/* Section 5 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">5. Data Retention</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We retain personal data only as long as:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-4">
                <li>Your account is active, or</li>
                <li>Necessary to provide services or meet legal obligations</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                You may request deletion of your account and data at any time.
              </p>
            </div>

            {/* Section 6 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">6. Security</h2>
              <p className="text-gray-700 leading-relaxed">
                We use industry-standard safeguards to protect your data, including encryption and access controls.
                However, no system is 100% secure, and we cannot guarantee absolute security.
              </p>
            </div>

            {/* Section 7 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">7. Children's Privacy</h2>
              <p className="text-gray-700 leading-relaxed mb-3">
                MarkIt is intended for students 13 years and older.
              </p>
              <p className="text-gray-700 leading-relaxed">
                If we learn we have collected data from a child under 13 without parental consent, we will delete it.
              </p>
            </div>

            {/* Section 8 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">8. Your Rights</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Depending on your location, you may have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4 mb-4">
                <li>Access your personal data</li>
                <li>Request correction or deletion</li>
                <li>Opt out of certain communications</li>
              </ul>
              <p className="text-gray-700 leading-relaxed">
                Contact us at{" "}
                <a 
                  href="mailto:markit.contact1@gmail.com" 
                  className="text-home-primary hover:underline font-semibold"
                >
                  markit.contact1@gmail.com
                </a>
                {" "}to exercise these rights.
              </p>
            </div>

            {/* Section 9 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">9. Changes to This Policy</h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy. If changes are significant, we will notify users through the app or website.
              </p>
            </div>

            {/* Section 10 */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-home-foreground mb-6">10. Contact</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-home-primary" />
                  <a 
                    href="mailto:markit.contact1@gmail.com" 
                    className="text-home-primary hover:underline font-semibold text-lg"
                  >
                    markit.contact1@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-home-primary" />
                  <a 
                    href="https://markit.chat" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-home-primary hover:underline font-semibold text-lg"
                  >
                    https://markit.chat
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-home-surface py-12 mt-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <Link to="/" className="flex items-center gap-1.5 mb-4 md:mb-0">
              <div className="w-8 h-8 flex items-center justify-center">
                <Book className="w-5 h-5 text-home-primary" />
              </div>
              <span className="text-xl font-bold text-home-foreground">MarkIt</span>
            </Link>
            
            <div className="flex gap-6 text-sm text-gray-600">
              <Link to="/privacy" className="hover:text-home-foreground transition-colors font-semibold">Privacy</Link>
              <Link to="/terms" className="hover:text-home-foreground transition-colors">Terms</Link>
              <a href="mailto:markit.contact1@gmail.com" className="hover:text-home-foreground transition-colors">Support</a>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-600">
            © 2025 MarkIt. Building the future of collaborative learning.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Privacy;

