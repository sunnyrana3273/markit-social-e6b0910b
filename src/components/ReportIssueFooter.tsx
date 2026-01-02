import { ExternalLink } from "lucide-react";

const ReportIssueFooter = () => {
  return (
    <footer className="w-full py-2">
      <div className="text-center">
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSciBO76pj2-PoELx7HfwYIWnYtrApvamkxdxFsmQ6bMIZWDYg/viewform?usp=publish-editor"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 opacity-60 hover:opacity-100"
        >
          <span>Report Issue</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </footer>
  );
};

export default ReportIssueFooter;

