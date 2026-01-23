import { Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Home from './Pages/Home';
import Blog from './Pages/Blog';
import BlogPost from './Pages/BlogPost';
import Gallery from './Pages/Gallery';
import Links from './Pages/Links';
import AdminDashboard from './Pages/AdminDashboard';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout currentPageName="Home"><Home /></Layout>} />
      <Route path="/Blog" element={<Layout currentPageName="Blog"><Blog /></Layout>} />
      <Route path="/BlogPost" element={<Layout currentPageName="Blog"><BlogPost /></Layout>} />
      <Route path="/Gallery" element={<Layout currentPageName="Gallery"><Gallery /></Layout>} />
      <Route path="/Links" element={<Layout currentPageName="Links"><Links /></Layout>} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}

export default App;