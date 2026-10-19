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

module OnlyOffice
  class Config
    class SSL
      extend T::Sig

      sig { returns(T::Boolean) }
      def verification_disabled
        @verify_mode == OpenSSL::SSL::VERIFY_NONE
      end
    end

    class JWT
      sig { params(header: String).returns(T.nilable(String)) }
      def decode_header(header)
        token = header["Bearer ".length, header.length - 1]
        unless token
          return nil
        end

        payload = jwt.decode_header(token)
        payload.to_json
      end

      sig { params(input: T.any(IO, StringIO)).returns(T.nilable(String)) }
      def decode_body(input)
        if input.respond_to?(:rewind)
          input.rewind
        end

        json = input.read
        unless json
          return nil
        end

        data = JSON.parse(json)
        payload = jwt.decode_body(data)
        payload.to_json
      end

      sig { params(url: String).returns(T.nilable(String)) }
      def decode_url(url)
        uri = T.cast(URI(url), URI::HTTP)
        uri = jwt.decode_uri(uri)
        uri.to_s
      end

      sig { params(payload: T::Hash[T.untyped, T.untyped]).returns(String) }
      def encode_payload(payload)
        body = jwt.encode_body(payload)
        body.to_json
      end

      sig { params(url: String).returns(String) }
      def encode_url(url)
        uri = T.cast(URI(url), URI::HTTP)
        uri = jwt.encode_uri(uri)
        uri.to_s
      end

      sig { returns(Onlyoffice::DocsIntegrationSdk::Jwt) }
      def jwt
        Onlyoffice::DocsIntegrationSdk::Jwt.new(
          secret: secret,
          algorithm: algorithm,
          claims: []
        )
      end
    end
  end
end
