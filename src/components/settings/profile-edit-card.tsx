"use client";

import { useEffect, useState, useCallback } from "react";
import { Pencil, CalendarDays } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarPicker } from "./avatar-picker";
import { fetchProfile, updateProfile, type UserProfile } from "@/lib/data";
import { useTier } from "@/hooks/use-tier";
import { TierBadge } from "@/components/tier/tier-badge";
import { toast } from "@/components/ui/custom-toast";

export function ProfileEditCard() {
  const { tier, userId } = useTier();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#722F37");
  const [editPhoto, setEditPhoto] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoadError(null);
      const p = await fetchProfile(userId);
      setProfile(p);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load profile");
    }
  }, [userId]);

  useEffect(() => {
    // Wait until the tier hook has resolved the user ID before fetching —
    // otherwise the server action has no user to look up and returns null.
    if (userId === null || userId === undefined) return;
    loadProfile();
  }, [loadProfile, userId]);

  const startEdit = () => {
    if (!profile) return;
    setEditName(profile.displayName);
    setEditColor(profile.avatarColor);
    setEditPhoto(profile.photoURL);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile(
        {
          displayName: editName.trim(),
          avatarColor: editColor,
          photoURL: editPhoto,
        },
        userId
      );
      setProfile(updated);
      setEditing(false);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = profile?.displayName
    ? profile.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load your profile: {loadError}
              </p>
              <Button size="sm" variant="outline" onClick={loadProfile}>
                Retry
              </Button>
            </div>
          ) : (
            <div className="h-16 w-full bg-muted animate-pulse rounded" />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            {/* Avatar picker */}
            <AvatarPicker
              initials={
                editName
                  ? editName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : "?"
              }
              currentColor={editColor}
              currentPhoto={editPhoto}
              onColorSelect={(color) => {
                setEditColor(color);
                setEditPhoto(null); // Clear photo when color is picked
              }}
              onPhotoSelect={(dataUrl) => setEditPhoto(dataUrl)}
            />

            {/* Name input */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs">
                Display Name
              </Label>
              <Input
                id="profile-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {profile.photoURL ? (
                <AvatarImage src={profile.photoURL} />
              ) : null}
              <AvatarFallback
                className="text-lg text-white font-bold"
                style={{ backgroundColor: profile.avatarColor }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-lg">{profile.displayName}</p>
              <p className="text-muted-foreground text-sm">{profile.email}</p>
              <TierBadge tier={tier} className="mt-1" />
              {profile.createdAt && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <CalendarDays className="h-3 w-3" />
                  Member since{" "}
                  {new Date(profile.createdAt).toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={startEdit}
              className="shrink-0"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
