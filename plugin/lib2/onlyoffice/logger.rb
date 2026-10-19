#
# (c) Copyright Ascensio System SIA 2025
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# typed: true
# frozen_string_literal: true

require "logger"
require "sorbet-runtime"

module OnlyOffice
  class << self
    extend T::Sig

    # Redmine 5 uses Rails 6, which uses logger from the stdlib, which is
    # Logger. Redmine 6 uses Rails 7, which uses a custom implementation of
    # logger, which is BroadcastLogger.

    sig { returns(T.any(Logger, ActiveSupport::BroadcastLogger)) }
    attr_accessor :logger
  end

  @logger = Logger.new($stdout)
end
