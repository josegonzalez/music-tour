require 'rubygems'
require 'sinatra'

get '/' do
  "Put stuff here."
end

get '/test' do
  erb :test
end