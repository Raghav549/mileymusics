-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON albums
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verification_requests_updated_at BEFORE UPDATE ON verification_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update song count in album
CREATE OR REPLACE FUNCTION update_album_song_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE albums SET song_count = song_count + 1
    WHERE id = NEW.album_id AND NEW.album_id IS NOT NULL;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE albums SET song_count = GREATEST(0, song_count - 1)
    WHERE id = OLD.album_id AND OLD.album_id IS NOT NULL;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER album_song_count_trigger AFTER INSERT OR DELETE ON songs
  FOR EACH ROW EXECUTE FUNCTION update_album_song_count();

-- Function to update playlist song count
CREATE OR REPLACE FUNCTION update_playlist_song_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE playlists SET song_count = song_count + 1
    WHERE id = NEW.playlist_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE playlists SET song_count = GREATEST(0, song_count - 1)
    WHERE id = OLD.playlist_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER playlist_song_count_trigger AFTER INSERT OR DELETE ON playlist_songs
  FOR EACH ROW EXECUTE FUNCTION update_playlist_song_count();

-- Function to update room member count
CREATE OR REPLACE FUNCTION update_room_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE rooms SET member_count = member_count + 1
    WHERE id = NEW.room_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE rooms SET member_count = GREATEST(0, member_count - 1)
    WHERE id = OLD.room_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER room_member_count_trigger AFTER INSERT OR DELETE ON room_members
  FOR EACH ROW EXECUTE FUNCTION update_room_member_count();

-- Function to update followers count
CREATE OR REPLACE FUNCTION update_followers_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE users SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;
    UPDATE users SET following_count = following_count + 1
    WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET followers_count = GREATEST(0, followers_count - 1)
    WHERE id = OLD.following_id;
    UPDATE users SET following_count = GREATEST(0, following_count - 1)
    WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER followers_count_trigger AFTER INSERT OR DELETE ON followers
  FOR EACH ROW EXECUTE FUNCTION update_followers_count();

-- Function to update like counts
CREATE OR REPLACE FUNCTION update_like_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.song_id IS NOT NULL THEN
      UPDATE songs SET like_count = like_count + 1 WHERE id = NEW.song_id;
    END IF;
    IF NEW.album_id IS NOT NULL THEN
      UPDATE albums SET like_count = like_count + 1 WHERE id = NEW.album_id;
    END IF;
    IF NEW.playlist_id IS NOT NULL THEN
      UPDATE playlists SET like_count = like_count + 1 WHERE id = NEW.playlist_id;
    END IF;
    IF NEW.comment_id IS NOT NULL THEN
      UPDATE comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.song_id IS NOT NULL THEN
      UPDATE songs SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.song_id;
    END IF;
    IF OLD.album_id IS NOT NULL THEN
      UPDATE albums SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.album_id;
    END IF;
    IF OLD.playlist_id IS NOT NULL THEN
      UPDATE playlists SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.playlist_id;
    END IF;
    IF OLD.comment_id IS NOT NULL THEN
      UPDATE comments SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.comment_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER like_counts_trigger AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_like_counts();

-- Function to update play count from views
CREATE OR REPLACE FUNCTION update_play_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE songs SET play_count = play_count + 1 WHERE id = NEW.song_id;
    IF NEW.user_id IS NOT NULL THEN
      UPDATE users SET total_plays = total_plays + 1 WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER play_count_trigger AFTER INSERT ON views
  FOR EACH ROW EXECUTE FUNCTION update_play_count();

-- Function to update download count
CREATE OR REPLACE FUNCTION update_download_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE songs SET download_count = download_count + 1 WHERE id = NEW.song_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER download_count_trigger AFTER INSERT ON downloads
  FOR EACH ROW EXECUTE FUNCTION update_download_count();

-- Function to update comment count
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.song_id IS NOT NULL THEN
      UPDATE songs SET comment_count = comment_count + 1 WHERE id = NEW.song_id;
    END IF;
    IF NEW.album_id IS NOT NULL THEN
      UPDATE albums SET comment_count = comment_count + 1 WHERE id = NEW.album_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.song_id IS NOT NULL THEN
      UPDATE songs SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.song_id;
    END IF;
    IF OLD.album_id IS NOT NULL THEN
      UPDATE albums SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.album_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER comment_count_trigger AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- Function to update last message in conversation
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
DECLARE
  v_conv_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_conv_id FROM conversations
    WHERE (user1_id = NEW.from_user_id AND user2_id = NEW.to_user_id)
       OR (user1_id = NEW.to_user_id AND user2_id = NEW.from_user_id);
    
    IF v_conv_id IS NOT NULL THEN
      UPDATE conversations
      SET last_message_id = NEW.id, last_message_at = CURRENT_TIMESTAMP
      WHERE id = v_conv_id;
    ELSE
      INSERT INTO conversations (user1_id, user2_id, last_message_id, last_message_at)
      VALUES (NEW.from_user_id, NEW.to_user_id, NEW.id, CURRENT_TIMESTAMP);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER conversation_last_message_trigger AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();
