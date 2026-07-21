import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Home } from './pages/Home'
import { Catalog } from './pages/Catalog'
import { MoveDetail } from './pages/MoveDetail'
import { MoveForm } from './pages/MoveForm'
import { Collections } from './pages/Collections'
import { CollectionDetail } from './pages/CollectionDetail'
import { SharedCollection } from './pages/SharedCollection'
import { Discover } from './pages/Discover'
import { Import } from './pages/Import'
import { Lessons } from './pages/Lessons'
import { LessonNew } from './pages/LessonNew'
import { LessonDetail } from './pages/LessonDetail'
import { LessonEdit } from './pages/LessonEdit'
import { NewChooser } from './pages/NewChooser'
import { Profile } from './pages/Profile'
import { PublicProfile } from './pages/PublicProfile'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { Login } from './pages/Login'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/s/:slug" element={<SharedCollection />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/neu" element={<NewChooser />} />
        <Route path="/katalog" element={<Catalog />} />
        <Route path="/move/neu" element={<MoveForm />} />
        <Route path="/move/:id" element={<MoveDetail />} />
        <Route path="/move/:id/bearbeiten" element={<MoveForm />} />
        <Route path="/sammlungen" element={<Collections />} />
        <Route path="/sammlungen/:id" element={<CollectionDetail />} />
        <Route path="/entdecken" element={<Discover />} />
        <Route path="/import" element={<Import />} />
        <Route path="/lessons" element={<Lessons />} />
        <Route path="/lessons/neu" element={<LessonNew />} />
        <Route path="/lessons/:id/bearbeiten" element={<LessonEdit />} />
        <Route path="/lessons/:id" element={<LessonDetail />} />
        <Route path="/statistik" element={<Stats />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/profil/:username" element={<PublicProfile />} />
        <Route path="/einstellungen" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
