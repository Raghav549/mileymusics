-- Enable Row-Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE views ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_later ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view public profiles"
  ON users
  FOR SELECT
  USING (is_active AND deleted_at IS NULL);

CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Songs policies
CREATE POLICY "Anyone can view public songs"
  ON songs
  FOR SELECT
  USING (is_public AND deleted_at IS NULL);

CREATE POLICY "Users can view own songs"
  ON songs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert songs"
  ON songs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own songs"
  ON songs
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own songs"
  ON songs
  FOR DELETE
  USING (user_id = auth.uid());

-- Playlists policies
CREATE POLICY "Anyone can view public playlists"
  ON playlists
  FOR SELECT
  USING (is_public AND deleted_at IS NULL);

CREATE POLICY "Users can view own playlists"
  ON playlists
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create playlists"
  ON playlists
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own playlists"
  ON playlists
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own playlists"
  ON playlists
  FOR DELETE
  USING (user_id = auth.uid());

-- Playlist songs policies
CREATE POLICY "Users can view playlist songs"
  ON playlist_songs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_songs.playlist_id
      AND (playlists.is_public OR playlists.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can add to own playlists"
  ON playlist_songs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_songs.playlist_id
      AND playlists.user_id = auth.uid()
    )
  );

-- Comments policies
CREATE POLICY "Anyone can view comments"
  ON comments
  FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "Users can create comments"
  ON comments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own comments"
  ON comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON comments
  FOR DELETE
  USING (user_id = auth.uid());

-- Likes policies
CREATE POLICY "Users can view likes"
  ON likes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create likes"
  ON likes
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own likes"
  ON likes
  FOR DELETE
  USING (user_id = auth.uid());

-- Views policies
CREATE POLICY "Users can create view records"
  ON views
  FOR INSERT
  WITH CHECK (true);

-- Downloads policies
CREATE POLICY "Users can view own downloads"
  ON downloads
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create downloads"
  ON downloads
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- History policies
CREATE POLICY "Users can view own history"
  ON history
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create history"
  ON history
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Watch Later policies
CREATE POLICY "Users can view own watch later"
  ON watch_later
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can add to watch later"
  ON watch_later
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete from watch later"
  ON watch_later
  FOR DELETE
  USING (user_id = auth.uid());

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view own messages"
  ON messages
  FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can send messages"
  ON messages
  FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

-- Rooms policies
CREATE POLICY "Anyone can view public active rooms"
  ON rooms
  FOR SELECT
  USING (is_public AND is_active);

CREATE POLICY "Host can view own rooms"
  ON rooms
  FOR SELECT
  USING (host_user_id = auth.uid());

CREATE POLICY "Members can view room"
  ON rooms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = rooms.id
      AND room_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create rooms"
  ON rooms
  FOR INSERT
  WITH CHECK (host_user_id = auth.uid());

-- Room members policies
CREATE POLICY "Members can view room members"
  ON room_members
  FOR SELECT
  USING (
    room_id IN (
      SELECT id FROM rooms
      WHERE host_user_id = auth.uid() OR is_public = true
    )
  );

CREATE POLICY "Users can join rooms"
  ON room_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Followers policies
CREATE POLICY "Anyone can view followers"
  ON followers
  FOR SELECT
  USING (true);

CREATE POLICY "Users can follow"
  ON followers
  FOR INSERT
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can unfollow"
  ON followers
  FOR DELETE
  USING (follower_id = auth.uid());

-- Subscriptions policies
CREATE POLICY "Users can view own subscription"
  ON subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- Payments policies
CREATE POLICY "Users can view own payments"
  ON payments
  FOR SELECT
  USING (user_id = auth.uid());

-- Reports policies
CREATE POLICY "Users can create reports"
  ON reports
  FOR INSERT
  WITH CHECK (true);

-- Verification policies
CREATE POLICY "Users can view own verification"
  ON verification_requests
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create verification request"
  ON verification_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Devices policies
CREATE POLICY "Users can view own devices"
  ON devices
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create devices"
  ON devices
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Uploads policies
CREATE POLICY "Users can view own uploads"
  ON uploads
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create uploads"
  ON uploads
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- AI Songs policies
CREATE POLICY "Users can view own AI songs"
  ON ai_songs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create AI songs"
  ON ai_songs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- AI Jobs policies
CREATE POLICY "System can manage AI jobs"
  ON ai_jobs
  FOR ALL
  USING (true);
