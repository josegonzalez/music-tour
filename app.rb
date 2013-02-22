require 'rubygems'
require 'sinatra'

get '/' do
  erb :map
end

get '/humans.lol/' do
  redirect "http://hsmaker.com/harlemshake.asp?url=http://music-tour.heroku.com/"
end
