import { Schema, pipe } from 'effect'
import { Route } from 'foldkit'
import { defineRouteUnion, literal, slash, string } from 'foldkit/route'

export const ApplicationRoute = defineRouteUnion({
  Home: {},
  SongEdit: { songId: Schema.String },
  SongPlay: { songId: Schema.String },
  NotFound: { path: Schema.String },
})
export type ApplicationRoute = typeof ApplicationRoute.Type

export const homeRouter = pipe(Route.root, Route.mapTo(ApplicationRoute.Home))

export const songEditRouter = pipe(
  literal('songs'),
  slash(string('songId')),
  Route.mapTo(ApplicationRoute.SongEdit),
)

export const songPlayRouter = pipe(
  literal('songs'),
  slash(string('songId')),
  slash(literal('play')),
  Route.mapTo(ApplicationRoute.SongPlay),
)

const routeParser = Route.oneOf(songPlayRouter, songEditRouter, homeRouter)

export const urlToApplicationRoute = Route.parseUrlWithFallback(
  routeParser,
  ApplicationRoute.NotFound,
)
