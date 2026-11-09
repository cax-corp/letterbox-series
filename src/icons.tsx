import type { ComponentType } from "react";
import IosShareRounded from "@mui/icons-material/IosShareRounded";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import BookmarkBorderRounded from "@mui/icons-material/BookmarkBorderRounded";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import CheckRounded from "@mui/icons-material/CheckRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import MovieOutlined from "@mui/icons-material/MovieOutlined";
import ExploreOutlined from "@mui/icons-material/ExploreOutlined";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import FavoriteBorderRounded from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import ProgressActivity from "@mui/icons-material/AutorenewRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import StarBorderRounded from "@mui/icons-material/StarBorderRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import ThumbUpOutlined from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownOutlined from "@mui/icons-material/ThumbDownOutlined";
import NotificationsNoneRounded from "@mui/icons-material/NotificationsNoneRounded";
import HubOutlined from "@mui/icons-material/HubOutlined";
import CloseRounded from "@mui/icons-material/CloseRounded";
type Props = { size?: number; fill?: string; className?: string };
function icon(
  Icon: ComponentType<SvgIconProps>,
  Filled?: ComponentType<SvgIconProps>,
) {
  return function MaterialIcon({ size = 24, fill, className }: Props) {
    const Component = fill && fill !== "none" && Filled ? Filled : Icon;
    return (
      <Component
        aria-hidden="true"
        className={className}
        sx={{ fontSize: size, flexShrink: 0 }}
      />
    );
  };
}
export const Galaxy = icon(HubOutlined);
export const ShareIcon = icon(IosShareRounded);
export const ArrowLeft = icon(ArrowBackRounded),
  ArrowRight = icon(ArrowForwardRounded),
  Bookmark = icon(BookmarkBorderRounded),
  Check = icon(CheckRounded),
  Mail = icon(EmailOutlined),
  ChevronRight = icon(ChevronRightRounded),
  Clapperboard = icon(MovieOutlined),
  Compass = icon(ExploreOutlined),
  Download = icon(DownloadRounded),
  Film = icon(MovieOutlined),
  Heart = icon(FavoriteBorderRounded, FavoriteRounded),
  LoaderCircle = icon(ProgressActivity),
  LogOut = icon(LogoutRounded),
  Play = icon(PlayArrowRounded),
  Plus = icon(AddRounded),
  Search = icon(SearchRounded),
  Settings = icon(SettingsOutlined),
  Sparkles = icon(AutoAwesomeOutlined),
  Star = icon(StarBorderRounded, StarRounded),
  Sun = icon(LightModeOutlined),
  Moon = icon(DarkModeOutlined),
  User = icon(PersonOutlineRounded),
  X = icon(CloseRounded),
  Dislike = icon(ThumbDownOutlined),
  Like = icon(ThumbUpOutlined),
  Bell = icon(NotificationsNoneRounded);
