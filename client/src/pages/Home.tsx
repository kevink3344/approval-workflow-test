import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Hero */}
      <section className="py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-[--text] mb-4 tracking-tight">
          Approval Workflows
          <br />
          <span className="text-accent">Made Simple</span>
        </h1>
        <p className="text-lg text-[--text-muted] max-w-2xl mx-auto mb-10">
          Streamline your approval process with customizable workflows, real-time
          status tracking, and role-based access controls.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {isAuthenticated ? (
            <Link to="/dashboard" className="primary-button no-underline">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/register" className="primary-button no-underline">
                Get Started
              </Link>
              <Link to="/login" className="secondary-button no-underline">
                Sign In
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="grid sm:grid-cols-3 gap-6 mb-16">
        <div className="surface p-6">
          <div className="badge badge-blue mb-4">01</div>
          <h3 className="text-lg font-semibold text-[--text] mb-2">Create Workflows</h3>
          <p className="text-sm text-[--text-muted]">
            Define multi-step approval workflows with custom approvers for each stage.
            Tailor the process to your organization's needs.
          </p>
        </div>
        <div className="surface p-6">
          <div className="badge badge-green mb-4">02</div>
          <h3 className="text-lg font-semibold text-[--text] mb-2">Submit Requests</h3>
          <p className="text-sm text-[--text-muted]">
            Submit approval requests that automatically route to the correct
            approvers based on the workflow definition.
          </p>
        </div>
        <div className="surface p-6">
          <div className="badge badge-amber mb-4">03</div>
          <h3 className="text-lg font-semibold text-[--text] mb-2">Track Progress</h3>
          <p className="text-sm text-[--text-muted]">
            Monitor the status of your requests in real time. See who has approved,
            who is pending, and when each step was completed.
          </p>
        </div>
      </section>

      {/* Tech stack */}
      <section className="surface-muted p-6 mb-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[--text-muted] mb-3">
          Built With
        </h3>
        <div className="flex flex-wrap gap-3">
          <span className="badge badge-slate">React 18</span>
          <span className="badge badge-slate">TypeScript</span>
          <span className="badge badge-slate">Express</span>
          <span className="badge badge-slate">PostgreSQL</span>
          <span className="badge badge-slate">Tailwind CSS</span>
          <span className="badge badge-slate">JWT Auth</span>
        </div>
      </section>
    </div>
  );
}