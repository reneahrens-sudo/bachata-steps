import { Routes, Route, useLocation } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Home } from './pages/Home'
import { Catalog } from './pages/Catalog'
import { MoveDetail } from './pages/MoveDetail'
import { MoveForm } from './pages/MoveForm'
import { Collections } from './pages/Collections'
import { CollectionDetail } from './pages/CollectionDetail'
import { SharePage } from './pages/SharePage'
import { ShareLinks } from './pages/ShareLinks'
import { Discover } from './pages/Discover'
import { Import } from './pages/Import'
import { Lessons } from './pages/Lessons'
import { LessonNew } from './pages/LessonNew'
import { LessonDetail } from './pages/LessonDetail'
import { LessonEdit } from './pages/LessonEdit'
import { NewChooser } from './pages/NewChooser'
import { ComboNew } from './pages/ComboNew'
import { MyVideos } from './pages/MyVideos'
import { Profile } from './pages/Profile'
import { PublicProfile } from './pages/PublicProfile'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { Members } from './pages/Members'
import { Login } from './pages/Login'
import { AccessEnded } from './pages/AccessEnded'
import { useAuth } from './hooks/useAuth'
import { useAccess } from './hooks/useAccess'

export default function App() {
  const { isRealUser, loading } = useAuth()
  const { data: access } = useAccess()
  const location = useLocation()

  // Share links are the one public surface — they bypass the login wall (token-gated, read-only).
  if (location.pathname.startsWith('/s/')) {
    return (
      <Routes>
        <Route path="/s/:token" element={<SharePage />} />
      </Routes>
    )
  }

  // Invite-only: until a real account is signed in, the whole app is a login wall.
  if (loading) return <div className="grid min-h-svh place-items-center text-text-dim">Lädt…</div>
  if (!isRealUser) return <Login />
  // Signed in but no (longer a) member — e.g. an expired guest link → clear info page instead of an empty app.
  if (access && !access.isMember) return <AccessEnded isGuest={access.isGuest} />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/neu" element={<NewChooser />} />
        <Route path="/katalog" element={<Catalog />} />
        <Route path="/move/neu" element={<MoveForm />} />
        <Route path="/combo/neu-video" element={<ComboNew />} />
        <Route path="/move/:id" element={<MoveDetail />} />
        <Route path="/move/:id/bearbeiten" element={<MoveForm />} />
        <Route path="/sammlungen" element={<Collections />} />
        <Route path="/sammlungen/:id" element={<CollectionDetail />} />
        <Route path="/entdecken" element={<Discover />} />
        <Route path="/import" element={<Import />} />
        <Route path="/videos" element={<MyVideos />} />
        <Route path="/lessons" element={<Lessons />} />
        <Route path="/lessons/neu" element={<LessonNew />} />
        <Route path="/lessons/:id/bearbeiten" element={<LessonEdit />} />
        <Route path="/lessons/:id" element={<LessonDetail />} />
        <Route path="/statistik" element={<Stats />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/profil/:username" element={<PublicProfile />} />
        <Route path="/einstellungen" element={<Settings />} />
        <Route path="/mitglieder" element={<Members />} />
        <Route path="/links" element={<ShareLinks />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
