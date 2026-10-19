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

require "sorbet-runtime"

module OnlyOffice; end

module OnlyOffice::APP
  class CallbackError < T::Struct
    prop :error,   Integer, default: 0
    prop :message, String,  default: ""

    class << self
      extend T::Sig

      sig { returns(CallbackError) }
      attr_reader :no_error
    end

    @no_error = T.let(new(error: 0), CallbackError)
  end
end
