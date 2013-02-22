require 'rubygems'
require 'sinatra'

get '/' do
  "Put stuff here."
end

get '/map' do
  erb :map
end

get '/test' do
  erb :test
end
