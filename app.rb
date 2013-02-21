require 'rubygems'
require 'sinatra'

get '/' do
  "Put stuff here."
end

get '/test' do
  erb :test
end

get '/timeline' do
	erb :timeline
end