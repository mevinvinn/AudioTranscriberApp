import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-8xl font-bold text-gray-200 dark:text-gray-800">404</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2 mb-1">Page not found</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">The page you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Go to Dashboard
        </button>
      </div>
    </Layout>
  );
}
